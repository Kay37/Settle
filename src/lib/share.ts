export async function shareText(title: string, text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  try {
    await navigator.share({ title, text })
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false
    return false
  }
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
