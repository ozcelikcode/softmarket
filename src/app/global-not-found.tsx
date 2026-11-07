import './(frontend)/globals.css'
import Link from 'next/link'

/** Standalone 404 document for unmatched URLs across the separate root layouts. */
export default function GlobalNotFound() {
  return <html lang="tr"><body className="min-h-dvh bg-bg font-sans text-text">
    <main className="mx-auto max-w-2xl px-6 py-32 text-center">
      <p className="mb-4 text-accent">404</p>
      <h1 className="text-h1">Sayfa bulunamadı / Page not found</h1>
      <Link className="mt-8 inline-block text-accent underline" href="/">Ana sayfa / Home</Link>
    </main>
  </body></html>
}
