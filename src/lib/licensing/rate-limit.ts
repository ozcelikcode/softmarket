type Bucket = { tokens: number; at: number; expires: number }

/** Bounded token buckets. An active bucket cannot be evicted by flooding the map with new subjects. */
export function createLicensingLimiter(capacity = 10_000, denyOnOverflow = true) {
  const buckets = new Map<string, Bucket>()
  let nextCleanup = 0
  return (key: string, max: number, windowMs: number, now = performance.now()): number => {
    if (now >= nextCleanup) {
      for (const [id, bucket] of buckets) if (bucket.expires <= now) buckets.delete(id)
      nextCleanup = now + 1000
    }
    let bucket = buckets.get(key)
    if (!bucket) {
      if (buckets.size >= capacity) return denyOnOverflow ? 1 : 0
      bucket = { tokens: max, at: now, expires: now }
      buckets.set(key, bucket)
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
