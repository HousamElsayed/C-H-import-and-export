import { requireUser } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { configureMoney } from '@/lib/money'
import { can } from '@/lib/rbac'
import { NAV_SECTIONS } from '@/lib/nav'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { logout } from '@/app/login/actions'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()
  const settings = await getSettings()
  configureMoney(settings.locale, settings.currency)

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(user.role, item.permission)),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="flex min-h-screen">
      <Sidebar sections={sections} clinicName={settings.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          canBook={can(user.role, 'appointments:write')}
          logoutAction={logout}
        />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
