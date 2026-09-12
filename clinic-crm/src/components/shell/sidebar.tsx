'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeftRight,
  Boxes,
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardList,
  Gift,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { NavSection } from '@/lib/nav'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Users,
  ReceiptText,
  ChartNoAxesColumn,
  Boxes,
  Package,
  ClipboardList,
  ArrowLeftRight,
  ListChecks,
  Sparkles,
  Gift,
  Megaphone,
  MessageSquare,
  UserCog,
  Settings,
  ShieldCheck,
}

export function Sidebar({ sections, clinicName }: { sections: NavSection[]; clinicName: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white">
          {clinicName.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{clinicName}</p>
          <p className="text-xs text-ink-subtle">Clinic CRM</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard
                const active = isActive(item.href, item.exact)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-brand-soft font-medium text-brand-strong'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-ink-subtle')} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed left-3 top-3 z-30 rounded-lg border border-line bg-surface p-2 text-ink shadow-sm lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <aside className="no-print hidden w-60 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative h-full w-64 border-r border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-lg p-1.5 text-ink-subtle hover:bg-surface-muted"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {nav}
          </div>
        </div>
      ) : null}
    </>
  )
}
