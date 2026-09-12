'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, verifyPassword } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  next: z.string().optional(),
})

export type LoginState = { error?: string }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the details you entered.' }
  }

  const { email, password, next } = parsed.data
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  // Same message for unknown email and wrong password so accounts cannot be enumerated.
  const invalid = { error: 'Email or password is incorrect.' }
  if (!user || !user.isActive) return invalid

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    await recordAudit({
      userId: user.id,
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: user.id,
      summary: 'Failed sign-in attempt',
    })
    return invalid
  }

  const headerList = await headers()
  await createSession(user.id, {
    userAgent: headerList.get('user-agent') ?? undefined,
    ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await recordAudit({
    userId: user.id,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    summary: 'Signed in',
  })

  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  redirect(target)
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
