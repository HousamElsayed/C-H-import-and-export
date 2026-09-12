import { formatMoney } from '@/lib/money'

export type StackedSeries = { key: string; label: string; color: string }
export type StackedPoint = { label: string; values: Record<string, number> }

/**
 * Vertical stacked bars for a money-over-time series. Rendered as SVG on the
 * server: no chart library, no client JavaScript. Hover text comes from the
 * native <title> on each segment.
 */
export function StackedBars({
  points,
  series,
  height = 200,
}: {
  points: StackedPoint[]
  series: StackedSeries[]
  height?: number
}) {
  const totals = points.map((point) =>
    series.reduce((sum, entry) => sum + (point.values[entry.key] ?? 0), 0),
  )
  const max = Math.max(...totals, 1)

  // Round the axis up to a friendly step so gridlines read cleanly.
  const step = niceStep(max / 3)
  const axisMax = Math.max(step * 3, Math.ceil(max / step) * step)
  const gridValues = [0, step, step * 2, step * 3].filter((value) => value <= axisMax)

  const plotHeight = height - 26
  const barGap = 10
  const columnWidth = 100 / points.length

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((entry) => (
          <span key={entry.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>

      <div className="relative" style={{ height }}>
        {gridValues.map((value) => (
          <div
            key={value}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: 26 + (value / axisMax) * plotHeight }}
          >
            <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-ink-subtle">
              {formatMoney(value, { withSymbol: false })}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}

        <div className="absolute inset-y-0 left-16 right-0 flex items-end">
          {points.map((point, index) => {
            const total = totals[index] ?? 0
            let offset = 0
            return (
              <div
                key={point.label}
                className="group relative flex h-full flex-col justify-end"
                style={{ width: `${columnWidth}%` }}
              >
                {/* Margin, not padding: absolute segments resolve against the
                    padding box, so padding would not separate the bars. */}
                <div
                  className="relative"
                  style={{ height: plotHeight, marginLeft: barGap / 2, marginRight: barGap / 2 }}
                >
                  {series.map((entry, seriesIndex) => {
                    const value = point.values[entry.key] ?? 0
                    if (value <= 0) return null
                    const segmentHeight = (value / axisMax) * plotHeight
                    const bottom = (offset / axisMax) * plotHeight
                    offset += value
                    const isTop = series
                      .slice(seriesIndex + 1)
                      .every((later) => (point.values[later.key] ?? 0) <= 0)

                    return (
                      <div
                        key={entry.key}
                        title={`${point.label} · ${entry.label}: ${formatMoney(value)}`}
                        className="absolute inset-x-0 transition-opacity hover:opacity-85"
                        style={{
                          bottom,
                          height: Math.max(2, segmentHeight - 2),
                          backgroundColor: entry.color,
                          borderTopLeftRadius: isTop ? 4 : 0,
                          borderTopRightRadius: isTop ? 4 : 0,
                        }}
                      />
                    )
                  })}
                </div>
                <span className="mt-1.5 block h-[18px] text-center text-[10px] text-ink-subtle">
                  {point.label}
                </span>
                {total > 0 ? (
                  <span
                    className="pointer-events-none absolute inset-x-0 text-center text-[10px] font-medium tabular-nums text-ink opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ bottom: 26 + (total / axisMax) * plotHeight + 4 }}
                  >
                    {formatMoney(total, { withSymbol: false })}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </figure>
  )
}

function niceStep(raw: number) {
  if (raw <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalised = raw / magnitude
  const snapped = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return snapped * magnitude
}
