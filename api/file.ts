import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Category } from '../src/types'
import { fileLocally } from '../src/lib/fileThoughts'

const VALID: Category[] = ['do', 'people', 'think', 'worry', 'later', 'note']

function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (VALID as string[]).includes(v)
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

  const chunks = (req.body as { chunks?: unknown })?.chunks
  if (!Array.isArray(chunks) || !chunks.every((c) => typeof c === 'string')) {
    return res.status(400).json({ error: 'chunks: string[] required' })
  }

  const fallback = fileLocally(chunks)
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
