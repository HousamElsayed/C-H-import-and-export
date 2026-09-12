'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Search, TriangleAlert } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonClass } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { formatMinutes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { emptyState, type ActionState } from '@/lib/forms'

type ClientOption = {
  id: string
  firstName: string
  lastName: string
  phone: string
  allergies: string | null
  noShowCount: number
}

type ServiceOption = {
  id: string
  name: string
  categoryName: string
  durationMin: number
  bufferMin: number
  priceMinor: number
  colorHex: string
  staffIds: string[]
  roomIds: string[]
  requiresConsent: boolean
  requiresPatchTest: boolean
}

type StaffOption = { id: string; firstName: string; lastName: string; colorHex: string }

const SOURCES = [
  ['PHONE', 'Phone'],
  ['WALK_IN', 'Walk-in'],
  ['WHATSAPP', 'WhatsApp'],
  ['INSTAGRAM', 'Instagram'],
  ['WEBSITE', 'Website'],
  ['REFERRAL', 'Referral'],
  ['OTHER', 'Other'],
]

export function BookingForm({
  action,
  clients,
  services,
  staff,
  rooms,
  defaults,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  clients: ClientOption[]
  services: ServiceOption[]
  staff: StaffOption[]
  rooms: { id: string; name: string }[]
  defaults: { clientId?: string; staffId?: string; date: string; time: string }
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [clientId, setClientId] = useState(defaults.clientId ?? '')
  const [clientQuery, setClientQuery] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState(defaults.staffId ?? '')
  const [time, setTime] = useState(defaults.time)

  const selectedClient = clients.find((client) => client.id === clientId)
  const selectedServices = selectedServiceIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is ServiceOption => Boolean(service))

  const treatmentMin = selectedServices.reduce((sum, service) => sum + service.durationMin, 0)
  const bufferMin = selectedServices.length > 0 ? Math.max(...selectedServices.map((s) => s.bufferMin)) : 0
  const totalMinor = selectedServices.reduce((sum, service) => sum + service.priceMinor, 0)

  const startMinutes = useMemo(() => {
    const [h, m] = time.split(':').map((part) => Number.parseInt(part, 10))
    return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m)
  }, [time])

  const eligibleStaff = useMemo(() => {
    if (selectedServices.length === 0) return staff
    return staff.filter((member) => selectedServices.every((service) => service.staffIds.includes(member.id)))
  }, [selectedServices, staff])

  const eligibleRooms = useMemo(() => {
    if (selectedServices.length === 0) return rooms
    const allowed = new Set(selectedServices.flatMap((service) => service.roomIds))
    const filtered = rooms.filter((room) => allowed.has(room.id))
    return filtered.length > 0 ? filtered : rooms
  }, [selectedServices, rooms])

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase()
    if (!query) return clients.slice(0, 8)
    return clients
      .filter((client) =>
        `${client.firstName} ${client.lastName} ${client.phone}`.toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [clientQuery, clients])

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceOption[]>()
    for (const service of services) {
      const bucket = map.get(service.categoryName) ?? []
      bucket.push(service)
      map.set(service.categoryName, bucket)
    }
    return [...map.entries()]
  }, [services])

  function toggleService(id: string) {
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const staffNotEligible = staffId !== '' && !eligibleStaff.some((member) => member.id === staffId)

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <input type="hidden" name="clientId" value={clientId} />
      {selectedServiceIds.map((id) => (
        <input key={id} type="hidden" name="serviceIds" value={id} />
      ))}

      <Card>
        <CardHeader title="Client" />
        <CardBody className="space-y-3">
          {selectedClient ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {selectedClient.firstName} {selectedClient.lastName}
                </p>
                <p className="text-xs text-ink-muted">{selectedClient.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setClientId('')}
                className="text-xs font-medium text-brand hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or phone…"
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                />
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {filteredClients.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-ink-muted">
                    No match.{' '}
                    <Link href="/clients/new" className="text-brand hover:underline">
                      Create a client
                    </Link>
                  </li>
                ) : (
                  filteredClients.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => setClientId(client.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-surface-muted"
                      >
                        <span>
                          <span className="block text-sm text-ink">
                            {client.firstName} {client.lastName}
                          </span>
                          <span className="block text-xs text-ink-subtle">{client.phone}</span>
                        </span>
                        {client.allergies ? (
                          <TriangleAlert className="h-4 w-4 shrink-0 text-danger" />
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}

          {selectedClient?.allergies ? (
            <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              Allergies: {selectedClient.allergies}
            </p>
          ) : null}
          {selectedClient && selectedClient.noShowCount >= 2 ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
              {selectedClient.noShowCount} previous no-shows — consider taking a deposit.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Services"
          description={
            selectedServices.length > 0
              ? `${treatmentMin} min treatment${bufferMin ? ` + ${bufferMin} min clean-down` : ''} · ${formatMoney(totalMinor)}`
              : 'Pick one or more treatments.'
          }
        />
        <CardBody className="space-y-4">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <p className="label">{category}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((service) => {
                  const selected = selectedServiceIds.includes(service.id)
                  return (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                        selected
                          ? 'border-brand-ring bg-brand-soft text-brand-strong'
                          : 'border-line bg-surface text-ink-muted hover:bg-surface-muted',
                      )}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : (
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: service.colorHex }} />
                      )}
                      <span>
                        {service.name}
                        <span className="block text-xs opacity-70">
                          {service.durationMin} min · {formatMoney(service.priceMinor)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {selectedServices.some((service) => service.requiresConsent) ? (
            <p className="rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-sm text-info">
              A consent form is required before this treatment.
            </p>
          ) : null}
          {selectedServices.some((service) => service.requiresPatchTest) ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
              A patch test is required before this treatment.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="When and with whom" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="date" required>
            <Input id="date" name="date" type="date" defaultValue={defaults.date} required />
          </Field>
          <Field
            label="Start time"
            htmlFor="time"
            required
            hint={
              treatmentMin > 0
                ? `Ends at ${formatMinutes(startMinutes + treatmentMin + bufferMin)}`
                : undefined
            }
          >
            <Input
              id="time"
              name="time"
              type="time"
              step={900}
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Team member"
            htmlFor="staffId"
            required
            error={staffNotEligible ? 'This person is not set up for every selected service.' : undefined}
          >
            <Select
              id="staffId"
              name="staffId"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              required
            >
              <option value="">Choose…</option>
              {staff.map((member) => {
                const eligible = eligibleStaff.some((item) => item.id === member.id)
                return (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                    {eligible ? '' : ' (not trained for this)'}
                  </option>
                )
              })}
            </Select>
          </Field>
          <Field label="Room" htmlFor="roomId">
            <Select id="roomId" name="roomId" defaultValue="">
              <option value="">No room</option>
              {eligibleRooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Booked via" htmlFor="source">
            <Select id="source" name="source" defaultValue="PHONE">
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Deposit taken" htmlFor="deposit" hint="Optional. Recorded against the appointment.">
            <Input id="deposit" name="deposit" inputMode="decimal" defaultValue="0,00" />
          </Field>
          <Field label="Note for the therapist" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4">
        <div className="text-sm">
          <p className="font-medium text-ink">
            {selectedServices.length === 0
              ? 'No services selected'
              : `${selectedServices.length} service${selectedServices.length === 1 ? '' : 's'} · ${treatmentMin + bufferMin} min`}
          </p>
          <p className="text-ink-muted">{formatMoney(totalMinor)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/calendar" className={buttonClass('outline', 'md')}>Cancel</Link>
          <SubmitButton disabled={!clientId || selectedServiceIds.length === 0 || !staffId} pendingLabel="Booking…">
            Book appointment
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
