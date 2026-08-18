import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Thought } from '../src/types'
import { localAsk } from '../src/lib/askShared'
import { allowRequest, clientKey } from './_rateLimit'

function checkSecret(req: VercelRequest): boolean {
  const secret = process.env.FILING_SECRET?.trim()
  if (!secret) return true
  const header = req.headers.authorization
  if (header === `Bearer ${secret}`) return true
  return req.headers['x-filing-secret'] === secret
}

async function askOpenAI(query: string, snippets: string[], apiKey: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Given a user question and numbered snippets from their brain dumps, return JSON { "matches": number[] } — indices of relevant snippets, most relevant first. Max 8.',
        },
        {
          role: 'user',
          content: JSON.stringify({ query, snippets }),
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`openai ${res.status}`)
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = body.choices?.[0]?.message?.content
  if (!raw) throw new Error('empty')
  const parsed = JSON.parse(raw) as { matches?: number[] }
  if (!Array.isArray(parsed.matches)) throw new Error('bad shape')
  return parsed.matches.filter((n) => Number.isInteger(n) && n >= 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  if (!allowRequest(clientKey(req))) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  if (!checkSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body as {
    query?: unknown
    thoughts?: unknown
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) return res.status(400).json({ error: 'query required' })

  const thoughts = Array.isArray(body.thoughts)
    ? (body.thoughts as Thought[]).filter(
        (t) => t && typeof t.id === 'string' && typeof t.text === 'string',
      )
    : []

  if (!thoughts.length) {
    return res.status(200).json({ ids: [], source: 'local' })
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const local = localAsk(thoughts, query)
  const fallbackIds = local.map((t) => t.id)

  if (apiKey && thoughts.length <= 80) {
    try {
      const snippets = thoughts.slice(0, 80).map(
        (t, i) => `${i}: ${t.title} — ${t.text.slice(0, 100)}`,
      )
      const indices = await askOpenAI(query, snippets, apiKey)
      const ids = indices
        .map((i) => thoughts[i]?.id)
        .filter((id): id is string => Boolean(id))
      if (ids.length) {
        return res.status(200).json({ ids, source: 'openai' })
      }
    } catch {
      /* fallback */
    }
  }

  return res.status(200).json({ ids: fallbackIds, source: 'local' })
}
