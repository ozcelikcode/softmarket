import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { Forbidden } from 'payload'

import { isAdmin, isAdminOrEditor, isAdminOrEditorField, isAdminOrEditorUser, isCustomerUser, isOwnerCustomer } from '@/access'
import { getLicensedProductIds } from '@/access/licenses'

const enforceTicketRules: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (!req.user || isAdminOrEditorUser(req.user)) return data
  if (!isCustomerUser(req.user) || operation !== 'create') throw new Forbidden(req.t)
  const product = typeof data.product === 'object' ? data.product?.id : data.product
  if (!product || !(await getLicensedProductIds(req)).includes(product)) throw new Forbidden(req.t)
  return { subject: String(data.subject ?? '').slice(0, 200), product: data.product,
    customer: req.user.id, status: 'open', priority: 'normal' }
}

export const SupportTickets: CollectionConfig = {
  slug: 'support-tickets',
  labels: { singular: 'Support Ticket', plural: 'Support Tickets' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'customer', 'status', 'priority', 'lastMessageAt'],
    group: 'Support',
  },
  defaultSort: '-lastMessageAt',
  access: {
    read: isOwnerCustomer('customer'),
    create: ({ req: { user } }) => isAdminOrEditorUser(user) || isCustomerUser(user),
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: { beforeChange: [enforceTicketRules] },
  fields: [
    { name: 'subject', type: 'text', required: true, maxLength: 200 },
    {
      type: 'row',
      fields: [
        {
          name: 'customer',
          type: 'relationship',
          relationTo: 'customers',
          required: true,
          index: true,
          access: { update: isAdminOrEditorField },
        },
        { name: 'product', type: 'relationship', relationTo: 'products' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'open',
          index: true,
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Waiting for customer', value: 'pending' },
            { label: 'Resolved', value: 'resolved' },
            { label: 'Closed', value: 'closed' },
          ],
        },
        {
          name: 'priority',
          type: 'select',
          required: true,
          defaultValue: 'normal',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Normal', value: 'normal' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ],
        },
      ],
    },
    { name: 'messages', type: 'join', collection: 'support-ticket-messages', on: 'ticket' },
    {
      name: 'lastMessageAt',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
