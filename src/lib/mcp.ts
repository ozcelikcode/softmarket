import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { UnauthorizedError } from 'payload'
import { canAccessAdminPanel, isAdminUser, nobody } from '@/access'

export const mcpCollections = {
  'product-families': { enabled: true }, products: { enabled: true }, editions: { enabled: true },
  solutions: { enabled: true }, industries: { enabled: true }, 'case-studies': { enabled: true },
  posts: { enabled: true }, careers: { enabled: true }, partners: { enabled: true },
  pages: { enabled: true }, docs: { enabled: true }, releases: { enabled: true },
  downloads: { enabled: true }, faqs: { enabled: true }, media: { enabled: true },
  licenses: { enabled: { create: true, find: true, update: true, delete: false } },
} satisfies MCPPluginConfig['collections']
export const mcpGlobals = {
  header: { enabled: { find: true, update: true } },
  footer: { enabled: { find: true, update: true } },
  'site-settings': { enabled: { find: true, update: true } },
} satisfies MCPPluginConfig['globals']

export const mcpOptions: MCPPluginConfig = {
  userCollection: 'users', collections: mcpCollections, globals: mcpGlobals,
  // This version always adds its key collection. Disable it; users API keys are the only credential.
  overrideApiKeyCollection: (collection) => ({
    ...collection, admin: { ...collection.admin, hidden: true },
    access: { admin: canAccessAdminPanel, read: nobody, create: nobody, update: nobody, delete: nobody },
  }),
  overrideAuth: async (req) => {
    const header = req.headers.get('authorization')
    const key = header?.match(/^(?:Bearer |users API-Key )([^\s]+)$/)?.[1]
    if (!key) throw new UnauthorizedError()
    // Authenticate only this header: never allow a session cookie to substitute for the API key.
    const { user } = await req.payload.auth({
      headers: new Headers({ authorization: `users API-Key ${key}` }),
    })
    if (!isAdminUser(user) || (user as { _strategy?: string } | null)?._strategy !== 'api-key') throw new UnauthorizedError()
    // The plugin runs as an admin: populated relationships otherwise bypass the MCP
    // collection allowlist, and upload updates accept arbitrary server file paths.
    const payload = req.payload
    req.payload = new Proxy(payload, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver)
        if (typeof value !== 'function') return value
        if (['find', 'findByID', 'create', 'update', 'delete', 'findGlobal', 'updateGlobal'].includes(String(property))) {
          return (options: Record<string, unknown>) => {
            if (options.filePath) throw new Error('Server file paths are not allowed through MCP')
            return value.call(target, { ...options, depth: 0 })
          }
        }
        return value.bind(target)
      },
    })
    const access: Record<string, unknown> = {}
    for (const [slug, { enabled }] of Object.entries({ ...mcpCollections, ...mcpGlobals })) {
      const name = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
      access[name] = enabled === true ? { create: true, find: true, update: true, delete: true } : enabled
    }
    return { ...access, user: user! }
  },
}
