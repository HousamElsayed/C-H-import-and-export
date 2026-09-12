import type { Permission } from '@/lib/rbac'

export type NavItem = {
  href: string
  label: string
  icon: string
  permission: Permission
  exact?: boolean
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Daily',
    items: [
      { href: '/', label: 'Today', icon: 'LayoutDashboard', permission: 'appointments:read', exact: true },
      { href: '/calendar', label: 'Calendar', icon: 'CalendarDays', permission: 'appointments:read' },
      { href: '/clients', label: 'Clients', icon: 'Users', permission: 'clients:read' },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/invoices', label: 'Invoices', icon: 'ReceiptText', permission: 'billing:read' },
      { href: '/reports', label: 'Reports', icon: 'ChartNoAxesColumn', permission: 'reports:read' },
    ],
  },
  {
    title: 'Stock',
    items: [
      { href: '/inventory', label: 'Stock dashboard', icon: 'Boxes', permission: 'inventory:read', exact: true },
      { href: '/inventory/products', label: 'Products', icon: 'Package', permission: 'inventory:read' },
      { href: '/inventory/consumption', label: 'Usage bills', icon: 'ClipboardList', permission: 'inventory:read' },
      { href: '/inventory/movements', label: 'Movements', icon: 'ArrowLeftRight', permission: 'inventory:read' },
      { href: '/inventory/counts', label: 'Stock takes', icon: 'ListChecks', permission: 'inventory:write' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { href: '/services', label: 'Services', icon: 'Sparkles', permission: 'catalog:read' },
      { href: '/packages', label: 'Packages', icon: 'Gift', permission: 'catalog:read' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/marketing', label: 'Campaigns', icon: 'Megaphone', permission: 'marketing:read' },
      { href: '/messages', label: 'Message log', icon: 'MessageSquare', permission: 'marketing:read' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/team', label: 'Team', icon: 'UserCog', permission: 'staff:read' },
      { href: '/settings', label: 'Settings', icon: 'Settings', permission: 'settings:write' },
      { href: '/audit', label: 'Audit log', icon: 'ShieldCheck', permission: 'audit:read' },
    ],
  },
]
