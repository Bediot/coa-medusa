type Timer = ReturnType<typeof setTimeout>

const pending = new Map<string, { timer: Timer; run: () => Promise<void> }>()

/**
 * Collapse rapid `product.updated` storms for the same id (image + variant + price).
 * In-process only — fine for a single worker replica.
 */
export function debounceByKey(
  key: string,
  ms: number,
  fn: () => Promise<void>
): void {
  if (ms <= 0) {
    void fn().catch(() => undefined)
    return
  }

  const existing = pending.get(key)
  if (existing) {
    clearTimeout(existing.timer)
  }

  const entry = {
    run: fn,
    timer: setTimeout(() => {
      pending.delete(key)
      void entry.run().catch(() => undefined)
    }, ms),
  }
  pending.set(key, entry)
}

/** Test helper — flush pending timers without waiting. */
export function clearDebounceState(): void {
  for (const { timer } of pending.values()) {
    clearTimeout(timer)
  }
  pending.clear()
}
