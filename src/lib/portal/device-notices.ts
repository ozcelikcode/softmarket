/** Result codes shown on the license page (`?cihaz=`). Anything else is ignored. */
export const DEVICE_NOTICES = ['released', 'limit', 'disabled', 'not_active', 'revoked', 'rate', 'error'] as const
export type DeviceNotice = (typeof DEVICE_NOTICES)[number]
