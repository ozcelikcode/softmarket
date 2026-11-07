import type { CollectionConfig } from 'payload'
import { Forbidden } from 'payload'
import { isAdminOrEditorUser, isCustomerUser } from '@/access'

export const SupportTicketMessages: CollectionConfig = {
  slug: 'support-ticket-messages',
  admin: { group: 'Support', useAsTitle: 'body' },
  access: {
    read: ({ req: { user } }) => isAdminOrEditorUser(user) ? true : isCustomerUser(user) ? { 'ticket.customer': { equals: user.id } } : false,
    create: ({ req: { user } }) => isAdminOrEditorUser(user) || isCustomerUser(user),
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [async ({ data, req }) => {
      if (!req.user) return data
      const ticket = typeof data.ticket === 'object' ? data.ticket?.id : data.ticket
      if (!ticket) throw new Forbidden(req.t)
      const result = await req.payload.find({
        collection: 'support-tickets',
        where: { and: [{ id: { equals: ticket } },
          ...(isCustomerUser(req.user) ? [{ customer: { equals: req.user.id } }] : []),
        ] },
        limit: 1, depth: 0, overrideAccess: true, req,
      })
      if (!result.docs.length || result.docs[0].status === 'closed') throw new Forbidden(req.t)
      if (isCustomerUser(req.user)) {
        return { ticket, body: data.body, author: 'customer', staffUser: null }
      }
      if (!isAdminOrEditorUser(req.user)) throw new Forbidden(req.t)
      return { ticket, body: data.body, author: 'staff', staffUser: req.user.id }
    }],
  },
  fields: [
    { name: 'ticket', type: 'relationship', relationTo: 'support-tickets', required: true, index: true },
    { name: 'author', type: 'select', required: true, options: ['customer', 'staff'] },
    { name: 'staffUser', type: 'relationship', relationTo: 'users' },
    { name: 'body', type: 'textarea', required: true, maxLength: 10000 },
  ],
}
