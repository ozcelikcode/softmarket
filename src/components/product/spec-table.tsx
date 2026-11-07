/** Definition-style specification table, grouped. Server component. */
export function SpecTable({ groups }: { groups: { title?: string; rows: [string, string][] }[] }) {
  return (
    <div className="space-y-10">
      {groups.filter((g) => g.rows.length).map((g, gi) => (
        <div key={`${g.title ?? 'g'}-${gi}`}>
          {g.title ? <h3 className="mb-3 text-h4 text-text">{g.title}</h3> : null}
          <dl className="overflow-hidden rounded-lg border border-border bg-surface">
            {g.rows.map(([label, value], i) => (
              <div key={`${label}-${i}`} className="grid gap-1 border-b border-border px-5 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
                <dt className="text-small text-muted">{label}</dt>
                <dd className="text-small text-text">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
