import type { UIFieldServerComponent } from 'payload'

import { isAdminUser } from '@/access/roles'
import { isSecretId, SECRET_LABELS, type SecretStatus } from '@/lib/integrations/ids'
import { envDefinesSmtp } from '@/lib/integrations/runtime'
import { readIntegrationsDoc, secretStatus } from '@/lib/integrations/vault'
import { envDefinesProvider } from '@/lib/payments/env'
import { readSecretsKey } from '@/lib/secrets/crypto'
import { IntegrationSecretClient } from './integration-secret-client'

/*
 * One write-only secret of the `integrations` global (a `ui` field: no column of its own). Server component: reads the
 * SAVED record with overrideAccess and passes ONLY the status (set · last 4 · updated at · readable) to the client.
 * Neither the plaintext nor the ciphertext ever reaches the RSC payload or the browser. Admin panel sessions only.
 */
export const IntegrationSecret: UIFieldServerComponent = async (props) => {
  const { payload, i18n, req } = props
  const secretId = (props as unknown as { secretId?: unknown }).secretId
  const user = req?.user as (typeof req.user & { _strategy?: string }) | null | undefined
  if (!isAdminUser(user) || user?._strategy === 'api-key' || !isSecretId(secretId)) return null
  const lang = i18n?.language === 'en' ? 'en' : 'tr'
  let status: SecretStatus | null = null
  try {
    status = secretStatus(await readIntegrationsDoc(payload), secretId)
  } catch {
    status = null
  }
  const envOverride = secretId === 'smtp.password' ? envDefinesSmtp() : envDefinesProvider(secretId.startsWith('stripe.') ? 'stripe' : 'iyzico')
  return (
    <IntegrationSecretClient
      secretId={secretId}
      label={SECRET_LABELS[secretId][lang]}
      lang={lang}
      status={status}
      envOverride={envOverride}
      keyConfigured={Boolean(readSecretsKey())}
    />
  )
}
