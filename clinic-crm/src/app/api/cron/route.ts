import { NextResponse, type NextRequest } from 'next/server'
import { constantTimeEquals } from '@/lib/auth'
import { flushQueue, queueAppointmentReminders } from '@/lib/messaging'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Scheduler entry point. Point a cron job at:
 *   curl -H "authorization: Bearer $CRON_SECRET" https://your-host/api/cron
 * Runs reminder queueing, expiry of stale packages, and the message queue.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!secret || !token || !constantTimeEquals(token, secret)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const reminders = await queueAppointmentReminders()

  const expired = await prisma.clientPackage.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })

  const queue = await flushQueue()

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    remindersQueued: reminders.queued,
    packagesExpired: expired.count,
    messages: queue,
  })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
