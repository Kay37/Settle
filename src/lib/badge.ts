/** PWA / installed-app icon badge for open loops (Badging API). */
export async function setOpenLoopBadge(count: number): Promise<void> {
  if (!('setAppBadge' in navigator)) return
  try {
    if (count > 0) await navigator.setAppBadge!(count)
    else await navigator.clearAppBadge!()
  } catch {
    /* unsupported or denied */
  }
}
