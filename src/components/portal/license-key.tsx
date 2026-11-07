'use client'

import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState, useTransition } from 'react'

import { revealLicenseKeyAction } from '@/lib/portal/actions'

type Labels = { reveal: string; hide: string; copy: string; copied: string; error: string }

/**
 * The full key is NOT in the page. It is fetched by a Server Action on click (owner-scoped)
 * and only lives in component state until hidden.
 */
export function LicenseKey({ id, masked, labels }: { id: number; masked: string; labels: Labels }) {
  const [key, setKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, start] = useTransition()
  const btn =
    'inline-flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50'

  const reveal = () =>
    start(async () => {
      const result = await revealLicenseKeyAction(id)
      setFailed(!result.key)
      setKey(result.key)
    })
  const copy = async () => {
    if (!key) return
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 md:justify-start">
      <code className="min-w-0 break-all font-mono text-small tracking-tight">{key ?? masked}</code>
      {key ? (
        <>
          <button type="button" className={btn} onClick={() => setKey(null)} aria-label={labels.hide} title={labels.hide}>
            <EyeOff aria-hidden className="size-4" />
          </button>
          <button type="button" className={btn} onClick={copy} aria-label={labels.copy} title={labels.copy}>
            {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </>
      ) : (
        <button type="button" className={btn} onClick={reveal} disabled={pending} aria-label={labels.reveal} title={labels.reveal}>
          <Eye aria-hidden className="size-4" />
        </button>
      )}
      <span role="status" className="sr-only">
        {copied ? labels.copied : ''}
        {failed ? labels.error : ''}
      </span>
      {failed ? <span className="text-small text-danger">{labels.error}</span> : null}
    </div>
  )
}
