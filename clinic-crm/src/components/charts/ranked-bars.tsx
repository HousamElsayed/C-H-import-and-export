/**
 * Horizontal ranked bars — one series, so identity lives in the row label and
 * no legend is needed. Values are labelled directly.
 */
export function RankedBars({
  rows,
  color = '#8b5b9e',
  formatValue,
}: {
  rows: { label: string; sublabel?: string; value: number }[]
  color?: string
  formatValue: (value: number) => string
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink">
              {row.label}
              {row.sublabel ? <span className="ml-1.5 text-xs text-ink-subtle">{row.sublabel}</span> : null}
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
              {formatValue(row.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-[4px] bg-surface-muted">
            <div
              className="h-full rounded-[4px]"
              style={{ width: `${Math.max(1.5, (row.value / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
