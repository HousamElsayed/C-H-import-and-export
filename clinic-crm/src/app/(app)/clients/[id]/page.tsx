import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  CalendarPlus,
  Cake,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { age, formatDate, formatDateTime } from '@/lib/dates'
import { initials } from '@/lib/utils'
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'
import {
  AppointmentStatusBadge,
  InvoiceStatusBadge,
  PackageStatusBadge,
} from '@/components/domain/status'
import { NoteForm } from '@/components/clients/note-form'
import { addClientNote } from '../actions'

export const dynamic = 'force-dynamic'

const TABS = [
  ['overview', 'Overview'],
  ['appointments', 'Appointments'],
  ['invoices', 'Invoices'],
  ['packages', 'Packages'],
  ['notes', 'Notes'],
] as const

export async function generateMetadata(props: PageProps<'/clients/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const client = await prisma.client.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  })
  return { title: client ? `${client.firstName} ${client.lastName}` : 'Client' }
}

export default async function ClientProfilePage(props: PageProps<'/clients/[id]'>) {
  const user = await requirePermission('clients:read')
  const { id } = await props.params
  const params = await props.searchParams
  const tab = typeof params.tab === 'string' ? params.tab : 'overview'

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      referredBy: { select: { id: true, firstName: true, lastName: true } },
      appointments: {
        orderBy: { startAt: 'desc' },
        take: 50,
        include: {
          staff: { select: { firstName: true, lastName: true, colorHex: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { items: { select: { description: true } } },
      },
      packages: {
        orderBy: { purchasedAt: 'desc' },
        include: {
          package: { select: { name: true } },
          items: { include: { service: { select: { name: true } } } },
        },
      },
      notes: {
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      consents: {
        orderBy: { createdAt: 'desc' },
        include: { template: { select: { name: true } } },
      },
    },
  })

  if (!client || client.isDeleted) notFound()

  const showMoney = can(user.role, 'billing:read')
  const showClinical = can(user.role, 'clients:clinical')
  const upcoming = client.appointments.filter(
    (item) => item.startAt > new Date() && item.status !== 'CANCELLED',
  )
  const averageSpend = client.visitCount > 0 ? Math.round(client.totalSpentMinor / client.visitCount) : 0

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-lg font-semibold text-brand-strong">
            {initials(client.firstName, client.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {client.firstName} {client.lastName}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {client.code}
              {client.birthDate ? ` · ${age(client.birthDate)} years` : ''}
              {client.city ? ` · ${client.city}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {client.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${tag.colorHex}1a`, color: tag.colorHex }}
                >
                  {tag.name}
                </span>
              ))}
              {client.noShowCount >= 2 ? (
                <Badge tone="danger">{client.noShowCount} no-shows</Badge>
              ) : null}
              {!client.kvkkConsentAt ? <Badge tone="warning">No data consent</Badge> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can(user.role, 'appointments:write') ? (
            <Link href={`/calendar/new?clientId=${client.id}`} className={buttonClass('primary', 'md')}>
              <CalendarPlus className="h-4 w-4" />
              Book
            </Link>
          ) : null}
          {can(user.role, 'clients:write') ? (
            <Link href={`/clients/${client.id}/edit`} className={buttonClass('outline', 'md')}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {client.allergies ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Allergies:</strong> {client.allergies}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2.5 text-ink">
                <Phone className="h-4 w-4 text-ink-subtle" />
                <a href={`tel:${client.phone}`} className="hover:text-brand">{client.phone}</a>
              </p>
              {client.email ? (
                <p className="flex items-center gap-2.5 text-ink">
                  <Mail className="h-4 w-4 text-ink-subtle" />
                  <a href={`mailto:${client.email}`} className="truncate hover:text-brand">{client.email}</a>
                </p>
              ) : null}
              {client.birthDate ? (
                <p className="flex items-center gap-2.5 text-ink">
                  <Cake className="h-4 w-4 text-ink-subtle" />
                  {formatDate(client.birthDate)}
                </p>
              ) : null}
              {client.address ? (
                <p className="flex items-start gap-2.5 text-ink">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                  <span>{client.address}</span>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {client.marketingSms ? <Badge tone="info">SMS ok</Badge> : null}
                {client.marketingEmail ? <Badge tone="info">Email ok</Badge> : null}
                {client.marketingWhatsapp ? <Badge tone="info">WhatsApp ok</Badge> : null}
              </div>
              {client.referredBy ? (
                <p className="pt-1 text-xs text-ink-muted">
                  Referred by{' '}
                  <Link href={`/clients/${client.referredBy.id}`} className="text-brand hover:underline">
                    {client.referredBy.firstName} {client.referredBy.lastName}
                  </Link>
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="At a glance" />
            <CardBody className="grid grid-cols-2 gap-4 text-sm">
              <Metric label="Visits" value={String(client.visitCount)} />
              <Metric label="No-shows" value={String(client.noShowCount)} />
              {showMoney ? <Metric label="Lifetime" value={formatMoney(client.totalSpentMinor)} /> : null}
              {showMoney ? <Metric label="Average" value={formatMoney(averageSpend)} /> : null}
              <Metric label="Loyalty points" value={String(client.loyaltyPoints)} />
              <Metric
                label="Last visit"
                value={client.lastVisitAt ? formatDate(client.lastVisitAt) : '—'}
              />
            </CardBody>
          </Card>

          {showClinical ? (
            <Card>
              <CardHeader title="Clinical" description="Confidential" />
              <CardBody className="space-y-3 text-sm">
                <ClinicalRow label="Skin type" value={client.skinType} />
                <ClinicalRow label="Allergies" value={client.allergies} tone="danger" />
                <ClinicalRow label="Medication" value={client.medications} />
                <ClinicalRow label="Medical history" value={client.medicalNotes} />
                <ClinicalRow label="Preferences" value={client.preferences} />
              </CardBody>
            </Card>
          ) : null}

          {client.consents.length > 0 ? (
            <Card>
              <CardHeader title="Consents" />
              <ul className="divide-y divide-line text-sm">
                {client.consents.map((consent) => (
                  <li key={consent.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="truncate text-ink">{consent.template.name}</span>
                    <Badge tone={consent.status === 'SIGNED' ? 'success' : 'warning'}>
                      {consent.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div>
          <div className="mb-4 flex flex-wrap gap-1.5 border-b border-line">
            {TABS.map(([value, label]) => {
              if (value === 'invoices' && !showMoney) return null
              const active = tab === value
              return (
                <Link
                  key={value}
                  href={`/clients/${client.id}?tab=${value}`}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                    active
                      ? 'border-brand font-medium text-brand-strong'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {tab === 'overview' ? (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Upcoming appointments" />
                {upcoming.length === 0 ? (
                  <EmptyState title="Nothing booked" description="This client has no future appointments." />
                ) : (
                  <ul className="divide-y divide-line">
                    {upcoming.map((appointment) => (
                      <li key={appointment.id} className="flex items-center gap-4 px-5 py-3">
                        <span className="w-32 shrink-0 text-sm font-medium text-ink">
                          {formatDateTime(appointment.startAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                          {appointment.services.map((service) => service.service.name).join(', ')} ·{' '}
                          {appointment.staff.firstName}
                        </span>
                        <AppointmentStatusBadge status={appointment.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Recent history" />
                {client.appointments.length === 0 ? (
                  <EmptyState title="No visits yet" />
                ) : (
                  <ul className="divide-y divide-line">
                    {client.appointments
                      .filter((appointment) => appointment.startAt <= new Date())
                      .slice(0, 8)
                      .map((appointment) => (
                        <li key={appointment.id} className="flex items-center gap-4 px-5 py-3">
                          <span className="w-32 shrink-0 text-sm text-ink-muted">
                            {formatDate(appointment.startAt)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {appointment.services.map((service) => service.service.name).join(', ')}
                          </span>
                          <AppointmentStatusBadge status={appointment.status} />
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : null}

          {tab === 'appointments' ? (
            <Card>
              <CardHeader title="All appointments" description={`${client.appointments.length} records`} />
              {client.appointments.length === 0 ? (
                <EmptyState title="No appointments" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Service</th>
                      <th>With</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.appointments.map((appointment) => (
                      <Tr key={appointment.id}>
                        <td>
                          <Link href={`/calendar/${appointment.id}`} className="text-ink hover:text-brand">
                            {formatDateTime(appointment.startAt)}
                          </Link>
                        </td>
                        <td>{appointment.services.map((service) => service.service.name).join(', ')}</td>
                        <td className="text-ink-muted">
                          {appointment.staff.firstName} {appointment.staff.lastName}
                        </td>
                        <td>
                          <AppointmentStatusBadge status={appointment.status} />
                        </td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          ) : null}

          {tab === 'invoices' && showMoney ? (
            <Card>
              <CardHeader title="Invoices" />
              {client.invoices.length === 0 ? (
                <EmptyState title="No invoices" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th className="text-right">Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.invoices.map((invoice) => (
                      <Tr key={invoice.id}>
                        <td>
                          <Link href={`/invoices/${invoice.id}`} className="font-medium text-ink hover:text-brand">
                            {invoice.number}
                          </Link>
                        </td>
                        <td className="text-ink-muted">
                          {formatDate(invoice.issuedAt ?? invoice.createdAt)}
                        </td>
                        <td className="max-w-xs truncate text-ink-muted">
                          {invoice.items.map((item) => item.description).join(', ')}
                        </td>
                        <td className="text-right font-medium tabular-nums">
                          {formatMoney(invoice.totalMinor)}
                        </td>
                        <td>
                          <InvoiceStatusBadge status={invoice.status} />
                        </td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          ) : null}

          {tab === 'packages' ? (
            <Card>
              <CardHeader title="Packages" description="Prepaid courses and remaining sessions" />
              {client.packages.length === 0 ? (
                <EmptyState title="No packages" description="Sell a package at checkout to prepay a course." />
              ) : (
                <ul className="divide-y divide-line">
                  {client.packages.map((clientPackage) => (
                    <li key={clientPackage.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-ink">{clientPackage.package.name}</p>
                          <p className="text-xs text-ink-muted">
                            Bought {formatDate(clientPackage.purchasedAt)} · expires{' '}
                            {formatDate(clientPackage.expiresAt)}
                          </p>
                        </div>
                        <PackageStatusBadge status={clientPackage.status} />
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {clientPackage.items.map((item) => {
                          const remaining = item.totalQty - item.usedQty
                          const percent = Math.round((item.usedQty / item.totalQty) * 100)
                          return (
                            <li key={item.id} className="text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-ink-muted">{item.service.name}</span>
                                <span className="shrink-0 tabular-nums text-ink">
                                  {remaining} of {item.totalQty} left
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                                <div
                                  className="h-full rounded-full bg-brand"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'notes' ? (
            <div className="space-y-6">
              {can(user.role, 'clients:write') ? (
                <Card>
                  <CardHeader title="Add a note" />
                  <CardBody>
                    <NoteForm
                      action={addClientNote.bind(null, client.id)}
                      canWriteClinical={showClinical}
                    />
                  </CardBody>
                </Card>
              ) : null}

              <Card>
                <CardHeader title="Notes" description={`${client.notes.length} entries`} />
                {client.notes.length === 0 ? (
                  <EmptyState title="No notes yet" icon={<Sparkles className="h-6 w-6" />} />
                ) : (
                  <ul className="divide-y divide-line">
                    {client.notes
                      .filter((note) => showClinical || !note.isClinical)
                      .map((note) => (
                        <li key={note.id} className="px-5 py-3.5">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                            <span>{formatDateTime(note.createdAt)}</span>
                            {note.author ? (
                              <span>· {note.author.firstName} {note.author.lastName}</span>
                            ) : null}
                            {note.isClinical ? (
                              <Badge tone="danger">
                                <ShieldAlert className="h-3 w-3" /> clinical
                              </Badge>
                            ) : null}
                            {note.isPinned ? <Badge tone="brand">pinned</Badge> : null}
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function ClinicalRow({
  label,
  value,
  tone,
}: {
  label: string
  value?: string | null
  tone?: 'danger'
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={`mt-0.5 whitespace-pre-wrap ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
