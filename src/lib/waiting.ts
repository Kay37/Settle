/** True when the dump describes waiting on someone else. */
export function isWaiting(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /\b(waiting on|waiting for|wait for|waiting to hear|haven't heard|hasn't replied|hasnt replied|need .+ to get back|need .+ to reply|ball's in .+ court|balls in .+ court)\b/.test(
      t,
    ) || /\bstill waiting\b/.test(t)
  )
}
