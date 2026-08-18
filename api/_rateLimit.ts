const WINDOW_MS = 60_000
const MAX_REQUESTS = 30

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function allowRequest(key: string): boolean {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  return bucket.count <= MAX_REQUESTS
}

export function clientKey(req: {
  headers?: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string | null }
}): string {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}
