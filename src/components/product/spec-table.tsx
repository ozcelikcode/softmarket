/** Definition-style specification table, grouped. Server component. */
type Attrs = Record<string, string>
/** `edit`: V5 visual editor markers per group title / row label+value (editing renders only). */
export function SpecTable({ groups }: { groups: { title?: string; rows: [string, string][]; edit?: { title?: Attrs; rows?: [Attrs, Attrs][] } }[] }) {
  return (
    <div className="space-y-10">
      {groups.filter((g) => g.rows.length).map((g, gi) => (
        <div key={`${g.title ?? 'g'}-${gi}`}>
          {g.title ? <h3 className="mb-3 text-h4 text-text" {...g.edit?.title}>{g.title}</h3> : null}
          <dl className="overflow-hidden rounded-lg border border-border bg-surface">
            {g.rows.map(([label, value], i) => (
              <div key={`${label}-${i}`} className="grid gap-1 border-b border-border px-5 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
                <dt className="text-small text-muted" {...g.edit?.rows?.[i]?.[0]}>{label}</dt>
                <dd className="text-small text-text" {...g.edit?.rows?.[i]?.[1]}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
