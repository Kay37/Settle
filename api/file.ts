import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Category } from '../src/types'
import { fileLocally } from '../src/lib/fileThoughts'
import { allowRequest, clientKey } from './_rateLimit'

const VALID: Category[] = ['do', 'people', 'think', 'worry', 'later', 'note']

function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (VALID as string[]).includes(v)
}

function authHeader(req: VercelRequest): string {
  const raw = req.headers.authorization
  return typeof raw === 'string' ? raw : ''
}

function checkSecret(req: VercelRequest): boolean {
  const secret = process.env.FILING_SECRET?.trim()
  if (!secret) return true
  const header = authHeader(req)
  if (header === `Bearer ${secret}`) return true
  const alt = req.headers['x-filing-secret']
  return alt === secret
}

async function fileWithOpenAI(chunks: string[], apiKey: string) {
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
            'File each brain-dump chunk into exactly one category: do, people, think, worry, later, note. Return JSON { "items": [{ "index": number, "title": string, "category": string, "person": string|null, "dueAt": string|null }] }. Keep titles short and actionable.',
        },
        {
          role: 'user',
          content: JSON.stringify({ chunks }),
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`openai ${res.status}`)

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = body.choices?.[0]?.message?.content
  if (!raw) throw new Error('empty openai response')

  const parsed = JSON.parse(raw) as {
    items?: Array<{
      index?: number
      title?: string
      category?: string
      person?: string | null
      dueAt?: string | null
    }>
  }

  if (!Array.isArray(parsed.items)) throw new Error('bad openai shape')
  return parsed.items
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  if (!allowRequest(clientKey(req))) {
    return res.status(429).json({ error: 'Too many requests — try again in a minute' })
  }

  if (!checkSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized — set Bearer token to FILING_SECRET' })
  }

  const body = req.body as { chunks?: unknown; learned?: unknown }
  const chunks = body.chunks
  if (!Array.isArray(chunks) || !chunks.every((c) => typeof c === 'string')) {
    return res.status(400).json({ error: 'chunks: string[] required' })
  }

  const learnedRaw = body.learned
  const learned = Array.isArray(learnedRaw)
    ? learnedRaw.filter(
        (r): r is { phrase: string; category: Category } =>
          typeof r === 'object' &&
          r !== null &&
          typeof (r as { phrase?: unknown }).phrase === 'string' &&
          isCategory((r as { category?: unknown }).category),
      )
    : []

  if (chunks.length > 40) {
    return res.status(400).json({ error: 'Max 40 chunks per request' })
  }

  const fallback = fileLocally(chunks, learned)
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (apiKey) {
    try {
      const ai = await fileWithOpenAI(chunks, apiKey)
      const items = chunks.map((_text, index) => {
        const hit = ai.find((i) => i.index === index)
        const base = fallback[index]
        return {
          index,
          title:
            typeof hit?.title === 'string' && hit.title.trim()
              ? hit.title.trim()
              : base.title,
          category: isCategory(hit?.category) ? hit.category : base.category,
          person: hit?.person?.trim() || base.person,
          dueAt: hit?.dueAt || base.dueAt,
        }
      })
      return res.status(200).json({ items, source: 'openai' })
    } catch {
      /* fall through to local rules */
    }
  }

  const items = fallback.map((item, index) => ({
    index,
    title: item.title,
    category: item.category,
    person: item.person,
    dueAt: item.dueAt,
  }))

  return res.status(200).json({ items, source: 'local' })
}
