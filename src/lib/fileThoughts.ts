import type { Category, LearnedRule } from '../types'
import { assign } from './assign'
import { classify, titleFromText } from './classify'

export type FiledItem = {
  text: string
  title: string
  category: Category
  dueAt: string | null
  person: string | null
  nextAction: string
}

const VALID: Category[] = ['do', 'people', 'think', 'worry', 'later', 'note']

function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (VALID as string[]).includes(v)
}

export function fileLocally(
  chunks: string[],
  learned: LearnedRule[] = [],
): FiledItem[] {
  return chunks.map((text) => {
    const category = classify(text, learned)
    const a = assign(text)
    const title = a.nextAction || titleFromText(text)
    return {
      text,
      title,
      category,
      dueAt: a.dueAt,
      person: a.person,
      nextAction: a.nextAction,
    }
  })
}

export async function fileWithEndpoint(
  chunks: string[],
  endpoint: string,
  token?: string,
  learned: LearnedRule[] = [],
): Promise<FiledItem[]> {
  const fallback = fileLocally(chunks, learned)
  if (!endpoint.trim() || chunks.length === 0) return fallback

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token?.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`
    }

    const res = await fetch(endpoint.trim(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ chunks }),
    })

    if (!res.ok) return fallback

    const parsed = (await res.json()) as {
      items?: Array<{
        index?: number
        title?: string
        category?: string
        person?: string
        dueAt?: string
      }>
    }

    if (!Array.isArray(parsed.items)) return fallback

    return chunks.map((_text, index) => {
      const hit = parsed.items?.find((i) => i.index === index)
      const base = fallback[index]
      const category = isCategory(hit?.category) ? hit.category : base.category
      const title =
        typeof hit?.title === 'string' && hit.title.trim()
          ? hit.title.trim()
          : base.title
      return {
        ...base,
        title,
        category,
        person: hit?.person?.trim() || base.person,
        dueAt: hit?.dueAt || base.dueAt,
      }
    })
  } catch {
    return fallback
  }
}
