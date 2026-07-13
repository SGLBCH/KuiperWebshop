'use client'

import { useEffect, useRef } from 'react'

// Cloudflare Turnstile-widget. Zonder NEXT_PUBLIC_TURNSTILE_SITE_KEY rendert
// dit niets en werkt de auth-flow zonder captcha — zo kan de site deployen
// vóórdat Turnstile in Cloudflare/Supabase is geconfigureerd.
//
// Belangrijk: de échte verificatie gebeurt server-side door Supabase
// (Auth → Attack Protection → CAPTCHA → Turnstile + secret key). De widget
// levert alleen het token; zonder geldige server-side check is een captcha
// schijnveiligheid.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
  }
}

export function turnstileActief(): boolean {
  return !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false

    function render() {
      if (cancelled || !containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return // al gerenderd
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      // Script eenmalig laden; daarna pollen tot de API beschikbaar is
      if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
        const script = document.createElement('script')
        script.src = SCRIPT_SRC
        script.async = true
        document.head.appendChild(script)
      }
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval)
          render()
        }
      }, 100)
      return () => {
        cancelled = true
        clearInterval(interval)
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }
      }
    }

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={containerRef} />
}
