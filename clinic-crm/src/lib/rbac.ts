import type { Role } from '@/generated/prisma/enums'

export const PERMISSIONS = [
  'clients:read',
  'clients:write',
  'clients:delete',
  'clients:clinical',
  'appointments:read',
  'appointments:write',
  'catalog:read',
  'catalog:write',
  'billing:read',
  'billing:write',
  'billing:void',
  'billing:refund',
  'inventory:read',
  'inventory:write',
  'inventory:consume',
  'marketing:read',
  'marketing:write',
  'reports:read',
  'reports:financial',
  'staff:read',
  'staff:write',
  'settings:write',
  'audit:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL: Permission[] = [...PERMISSIONS]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== 'settings:write'),
  RECEPTIONIST: [
    'clients:read',
    'clients:write',
    'appointments:read',
    'appointments:write',
    'catalog:read',
    'billing:read',
    'billing:write',
    'inventory:read',
    'inventory:consume',
    'marketing:read',
    'staff:read',
  ],
  THERAPIST: [
    'clients:read',
    'clients:write',
    'clients:clinical',
    'appointments:read',
    'appointments:write',
    'catalog:read',
    'inventory:read',
    'inventory:consume',
    'staff:read',
  ],
  ACCOUNTANT: [
    'clients:read',
    'appointments:read',
    'catalog:read',
    'billing:read',
    'billing:write',
    'billing:void',
    'billing:refund',
    'inventory:read',
    'inventory:write',
    'reports:read',
    'reports:financial',
    'staff:read',
    'audit:read',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  RECEPTIONIST: 'Receptionist',
  THERAPIST: 'Therapist',
  ACCOUNTANT: 'Accountant',
}
