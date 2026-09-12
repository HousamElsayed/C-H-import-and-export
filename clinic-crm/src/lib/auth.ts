import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { can, type Permission } from '@/lib/rbac'
import type { Role } from '@/generated/prisma/enums'

export const SESSION_COOKIE = 'clinic_session'
const SESSION_DAYS = 7

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  colorHex: string
  isBookable: boolean
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12)
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function constantTimeEquals(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 255),
      ipAddress: meta?.ip,
    },
  })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  jar.delete(SESSION_COOKIE)
}

/** Resolves the signed-in user. Memoised for the lifetime of one request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          colorHex: true,
          isBookable: true,
          isActive: true,
        },
      },
    },
  })

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null
  if (!session.user.isActive) return null

  const { isActive: _isActive, ...user } = session.user
  return user
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user.role, permission)) redirect('/forbidden')
  return user
}

/** For server actions: throws instead of redirecting so the caller can report it. */
export async function authorize(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in.')
  if (!can(user.role, permission)) throw new Error('You do not have permission to do this.')
  return user
}

export function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim()
}
