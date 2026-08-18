export function settleHaptic(): void {
  try {
    navigator.vibrate?.([16, 40, 16])
  } catch {
    /* ignore */
  }
}
