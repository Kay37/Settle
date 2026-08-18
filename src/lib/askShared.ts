import type { Thought } from '../types'

export function localAsk(thoughts: Thought[], query: string, limit = 8): Thought[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/).filter((t) => t.length > 1)

  return thoughts
    .filter((t) => !t.private)
    .map((t) => {
      const hay = `${t.title} ${t.text} ${t.person ?? ''} ${t.project ?? ''}`.toLowerCase()
      let score = 0
      if (hay.includes(q)) score += 10
      for (const tok of tokens) if (hay.includes(tok)) score += 2
      return { t, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t)
}

export async function askWithEndpoint(
  thoughts: Thought[],
  query: string,
  endpoint: string,
  token?: string,
): Promise<{ ids: string[]; source: string }> {
  const local = localAsk(thoughts, query)
  const fallback = { ids: local.map((t) => t.id), source: 'local' }
  if (!endpoint.trim() || !query.trim()) return fallback

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`

    const res = await fetch(endpoint.trim(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        thoughts: thoughts
          .filter((t) => !t.private)
          .slice(0, 80)
          .map((t) => ({
          id: t.id,
          title: t.title,
          text: t.text,
          category: t.category,
          person: t.person,
          project: t.project,
        })),
      }),
    })
    if (!res.ok) return fallback
    const data = (await res.json()) as { ids?: string[]; source?: string }
    if (!Array.isArray(data.ids)) return fallback
    return { ids: data.ids, source: data.source ?? 'openai' }
  } catch {
    return fallback
  }
}
