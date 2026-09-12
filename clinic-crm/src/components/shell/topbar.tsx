'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Plus } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Role } from '@/generated/prisma/enums'
import { initials } from '@/lib/utils'

export function Topbar({
  user,
  canBook,
  logoutAction,
}: {
  user: { firstName: string; lastName: string; email: string; role: Role; colorHex: string }
  canBook: boolean
  logoutAction: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur lg:px-6">
      {canBook ? (
        <Link href="/calendar/new" className={buttonClass('primary', 'sm')}>
          <Plus className="h-4 w-4" />
          New appointment
        </Link>
      ) : null}

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-surface-muted"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user.colorHex }}
          >
            {initials(user.firstName, user.lastName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight text-ink">
              {user.firstName} {user.lastName}
            </span>
            <span className="block text-xs leading-tight text-ink-subtle">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-ink-subtle" />
        </button>

        {open ? (
          <div className="absolute right-0 top-full mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            <div className="border-b border-line px-3 py-2.5">
              <p className="truncate text-sm font-medium text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-ink-subtle">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-muted transition hover:bg-surface-muted hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  )
}
