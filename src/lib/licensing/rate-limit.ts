type Bucket = { tokens: number; at: number; expires: number }

/** Keep active budgets intact. Untracked subjects share one bounded overflow budget. */
export function createLicensingLimiter(capacity = 10_000, observeOnly = false) {
  const buckets = new Map<string, Bucket>()
  let overflow: Bucket | undefined
  let nextCleanup = 0
  return (key: string, max: number, windowMs: number, now = performance.now()): number => {
    if (now >= nextCleanup) {
      for (const [id, bucket] of buckets) if (bucket.expires <= now) buckets.delete(id)
      nextCleanup = now + 1000
    }
    let bucket = buckets.get(key)
    if (!bucket) {
      if (buckets.size < capacity) {
        bucket = { tokens: max, at: now, expires: now }
        buckets.set(key, bucket)
      } else {
        // Observations can trigger per-subject blocks. A pooled count must never trigger one.
        if (observeOnly) return 0
        bucket = overflow ??= { tokens: max, at: now, expires: now }
      }
    }
    const refill = max / windowMs
    bucket.tokens = Math.min(max, bucket.tokens + Math.max(0, now - bucket.at) * refill)
    bucket.at = now
    const allowed = bucket.tokens >= 1
    if (allowed) bucket.tokens -= 1
    bucket.expires = now + (max - bucket.tokens) / refill
    return allowed ? 0 : Math.max(1, Math.ceil((1 - bucket.tokens) / refill / 1000))
  }
}
