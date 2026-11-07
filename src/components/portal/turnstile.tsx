'use client'

import Script from 'next/script'
import { useNonce } from '@/components/security/nonce-provider'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id: string) => void
    }
  }
}

/** Cloudflare Turnstile widget (same loader as the lead forms). Renders nothing without a site key. */
export function Turnstile({ siteKey, locale, resetKey }: { siteKey?: string; locale: string; resetKey?: unknown }) {
  const nonce = useNonce()
  const node = useRef<HTMLDivElement>(null)
  const id = useRef<string | undefined>(undefined)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready || !siteKey || !node.current || !window.turnstile) return
    id.current = window.turnstile.render(node.current, { sitekey: siteKey, language: locale })
    return () => {
      if (id.current) window.turnstile?.remove(id.current)
    }
  }, [ready, siteKey, locale])
  useEffect(() => {
    if (resetKey && id.current) window.turnstile?.reset(id.current)
  }, [resetKey])
  if (!siteKey) return null
  return (
    <>
      <Script nonce={nonce} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} />
      <div ref={node} />
    </>
  )
}
