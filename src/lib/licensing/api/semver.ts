const syntax = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

export function parseSemver(value: string) {
  const match = syntax.exec(value)
  // JavaScript's $ also matches before a trailing newline.
  if (!match || match[0] !== value) return null
  return { core: match.slice(1, 4), prerelease: match[4]?.split('.') ?? [] }
}

type Version = NonNullable<ReturnType<typeof parseSemver>>
const compareText = (a: string, b: string) => a === b ? 0 : a < b ? -1 : 1
const compareNumeric = (a: string, b: string) => a.length - b.length || compareText(a, b)
const numeric = /^\d+$/

export function compareSemver(a: Version, b: Version): number {
  for (const [index, left] of a.core.entries()) {
    const order = compareNumeric(left, b.core[index]!)
    if (order) return order
  }
  if (!a.prerelease.length || !b.prerelease.length) return b.prerelease.length - a.prerelease.length
  for (const [index, left] of a.prerelease.entries()) {
    const right = b.prerelease[index]
    if (right === undefined) return 1
    const aNumeric = numeric.test(left)
    const bNumeric = numeric.test(right)
    const order = aNumeric && bNumeric ? compareNumeric(left, right)
      : aNumeric !== bNumeric ? (aNumeric ? -1 : 1) : compareText(left, right)
    if (order) return order
  }
  return a.prerelease.length - b.prerelease.length
}
