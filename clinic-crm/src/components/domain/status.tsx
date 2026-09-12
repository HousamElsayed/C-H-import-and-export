import { Badge, type Tone } from '@/components/ui/badge'
import type {
  AppointmentStatus,
  ClientPackageStatus,
  ConsumptionBillStatus,
  InvoiceStatus,
  MessageStatus,
  StockMovementType,
} from '@/generated/prisma/enums'

const APPOINTMENT: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'neutral' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  ARRIVED: { label: 'Arrived', tone: 'brand' },
  IN_PROGRESS: { label: 'In treatment', tone: 'accent' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  NO_SHOW: { label: 'No-show', tone: 'danger' },
}

const INVOICE: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ISSUED: { label: 'Unpaid', tone: 'warning' },
  PARTIALLY_PAID: { label: 'Part paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  VOID: { label: 'Void', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'danger' },
}

const CONSUMPTION: Record<ConsumptionBillStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ISSUED: { label: 'Issued', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
}

const PACKAGE: Record<ClientPackageStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  COMPLETED: { label: 'Used up', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
}

const MESSAGE: Record<MessageStatus, { label: string; tone: Tone }> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  SENDING: { label: 'Sending', tone: 'info' },
  SENT: { label: 'Sent', tone: 'info' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  PURCHASE: 'Purchase',
  RETAIL_SALE: 'Retail sale',
  TREATMENT_USE: 'Treatment use',
  INTERNAL_USE: 'Internal use',
  ADJUSTMENT: 'Adjustment',
  RETURN_TO_SUPPLIER: 'Return to supplier',
  CUSTOMER_RETURN: 'Customer return',
  WASTAGE: 'Wastage',
  EXPIRY: 'Expiry write-off',
  STOCK_TAKE: 'Stock take',
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = APPOINTMENT[status]
  return <Badge tone={config.tone}>{config.label}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = INVOICE[status]
  return <Badge tone={config.tone}>{config.label}</Badge>
}

export function ConsumptionStatusBadge({ status }: { status: ConsumptionBillStatus }) {
  const config = CONSUMPTION[status]
  return <Badge tone={config.tone}>{config.label}</Badge>
}

export function PackageStatusBadge({ status }: { status: ClientPackageStatus }) {
  const config = PACKAGE[status]
  return <Badge tone={config.tone}>{config.label}</Badge>
}

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  const config = MESSAGE[status]
  return <Badge tone={config.tone}>{config.label}</Badge>
}

export const APPOINTMENT_STATUS_LABELS = APPOINTMENT
