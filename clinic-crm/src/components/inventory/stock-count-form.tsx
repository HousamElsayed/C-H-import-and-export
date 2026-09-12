'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Field, FormError, Input, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonClass } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'
import { formatQty } from '@/lib/utils'
import { emptyState, type ActionState } from '@/lib/forms'

type CountProduct = {
  id: string
  name: string
  sku: string
  unit: string
  stockQty: number
  costMinor: number
}

export function StockCountForm({
  action,
  products,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  products: CountProduct[]
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [counted, setCounted] = useState<Record<string, string>>({})

  const rows = products.map((product) => {
    const raw = counted[product.id]
    const value = raw === undefined || raw === '' ? null : Number.parseFloat(raw.replace(',', '.'))
    const variance = value === null || Number.isNaN(value) ? null : Math.round((value - product.stockQty) * 1000) / 1000
    return { product, variance }
  })

  const countedRows = rows.filter((row) => row.variance !== null)
  const varianceValue = countedRows.reduce(
    (sum, row) => sum + Math.round((row.variance ?? 0) * row.product.costMinor),
    0,
  )

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader
          title="Count sheet"
          description="Leave a line blank to skip it. Differences post as stock-take corrections."
        />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">System says</th>
                <th className="text-right">Counted</th>
                <th className="text-right">Difference</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, variance }) => (
                <tr key={product.id} className="border-b border-line">
                  <td className="px-4 py-2">
                    <span className="text-ink">{product.name}</span>
                    <span className="block text-xs text-ink-subtle">{product.sku}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink-muted">
                    {formatQty(product.stockQty, product.unit)}
                  </td>
                  <td className="px-4 py-2">
                    <input type="hidden" name="countProductId" value={product.id} />
                    <Input
                      name="countedQty"
                      inputMode="decimal"
                      className="ml-auto w-28 text-right"
                      value={counted[product.id] ?? ''}
                      onChange={(event) =>
                        setCounted((current) => ({ ...current, [product.id]: event.target.value }))
                      }
                      aria-label={`Counted quantity for ${product.name}`}
                    />
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      variance === null ? 'text-ink-subtle' : variance === 0 ? 'text-ink-muted' : variance > 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {variance === null ? '—' : `${variance > 0 ? '+' : ''}${formatQty(variance)}`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink-muted">
                    {variance === null || variance === 0
                      ? '—'
                      : formatMoney(Math.round(variance * product.costMinor))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardBody className="flex flex-wrap items-center justify-between gap-3 border-t border-line">
          <span className="text-sm text-ink-muted">
            {countedRows.length} of {products.length} lines counted
          </span>
          <span className={`text-sm font-medium tabular-nums ${varianceValue < 0 ? 'text-danger' : 'text-ink'}`}>
            Net variance {formatMoney(varianceValue)}
          </span>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} placeholder="Who counted, anything unusual…" />
          </Field>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/inventory/counts" className={buttonClass('outline', 'md')}>Cancel</Link>
        <SubmitButton disabled={countedRows.length === 0} pendingLabel="Posting…">
          Post stock take
        </SubmitButton>
      </div>
    </form>
  )
}
