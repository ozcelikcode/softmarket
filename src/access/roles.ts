import type { PayloadRequest, TypedUser } from 'payload'

import type { Customer, User } from '@/payload-types'

export const USER_ROLES = ['admin', 'editor'] as const
export type UserRole = (typeof USER_ROLES)[number]

export type StaffUser = User & { collection: 'users' }
export type CustomerUser = Customer & { collection: 'customers' }

type MaybeUser = PayloadRequest['user'] | TypedUser | null | undefined

/** Staff = authenticated member of the `users` collection (admin panel accounts). */
export const isStaffUser = (user: MaybeUser): user is StaffUser =>
  Boolean(user && user.collection === 'users')

/** Customer = authenticated member of the `customers` collection (portal accounts). */
export const isCustomerUser = (user: MaybeUser): user is CustomerUser =>
  Boolean(user && user.collection === 'customers')

export const hasRole = (user: MaybeUser, role: UserRole): boolean =>
  isStaffUser(user) && Array.isArray(user.roles) && user.roles.includes(role)

export const isAdminUser = (user: MaybeUser): boolean => hasRole(user, 'admin')

export const isAdminOrEditorUser = (user: MaybeUser): boolean =>
  hasRole(user, 'admin') || hasRole(user, 'editor')
