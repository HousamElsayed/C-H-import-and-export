import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { MINOR_PER_UNIT } from '@/lib/money'

export const dynamic = 'force-dynamic'

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Invoice-line export for accounting, one row per line item. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'reports:financial')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 })
  }

  const range = request.nextUrl.searchParams.get('range') ?? '30'
  const from = new Date()
  if (range === 'mtd') from.setDate(1)
  else from.setDate(from.getDate() - (Number.parseInt(range, 10) || 30))
  from.setHours(0, 0, 0, 0)

  const items = await prisma.invoiceItem.findMany({
    where: { invoice: { issuedAt: { gte: from }, status: { not: 'VOID' } } },
    orderBy: { invoice: { issuedAt: 'asc' } },
    include: {
      invoice: {
        select: {
          number: true,
          issuedAt: true,
          status: true,
          taxBps: true,
          client: { select: { code: true, firstName: true, lastName: true } },
          cashier: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  const header = [
    'Invoice', 'Date', 'Status', 'Client code', 'Client', 'Cashier',
    'Kind', 'Description', 'Quantity', 'Unit price', 'Discount', 'Line total', 'Cost', 'Tax rate %',
  ]

  const rows = items.map((item) => [
    item.invoice.number,
    item.invoice.issuedAt ? item.invoice.issuedAt.toISOString().slice(0, 10) : '',
    item.invoice.status,
    item.invoice.client?.code ?? '',
    item.invoice.client ? `${item.invoice.client.firstName} ${item.invoice.client.lastName}` : 'Walk-in',
    item.invoice.cashier ? `${item.invoice.cashier.firstName} ${item.invoice.cashier.lastName}` : '',
    item.kind,
    item.description,
    item.quantity,
    (item.unitPriceMinor / MINOR_PER_UNIT).toFixed(2),
    (item.discountMinor / MINOR_PER_UNIT).toFixed(2),
    (item.totalMinor / MINOR_PER_UNIT).toFixed(2),
    (item.costMinor / MINOR_PER_UNIT).toFixed(2),
    (item.invoice.taxBps / 100).toFixed(2),
  ])

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="clinic-sales-${from.toISOString().slice(0, 10)}.csv"`,
    },
  })
}
