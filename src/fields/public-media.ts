import type { Where } from 'payload'

// Payload's upload validator enforces these filters for API/import writes as well as the admin picker.
export const publicImageFilter: Where = {
  and: [{ mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'] } },
    { protected: { equals: false } }, { visibility: { equals: 'public' } }],
}
export const publicVideoFilter: Where = {
  and: [{ mimeType: { in: ['video/mp4', 'video/webm'] } },
    { protected: { equals: false } }, { visibility: { equals: 'public' } }],
}
