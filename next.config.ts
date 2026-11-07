import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import { validateServerUrl } from './src/lib/server-url'
import { contentSecurityPolicy } from './src/lib/csp'

validateServerUrl()

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Next 15 normalizes 127.0.0.1 to localhost before EN rewrites, which can
  // become an external proxy/redirect loop in next start. Preserve the URL.
  skipMiddlewareUrlNormalize: true,
  // Multiple root layouts need a standalone document for unmatched URLs (Next 15.4).
  experimental: { globalNotFound: true, optimizePackageImports: ['lucide-react', 'radix-ui'] },
  // Only repo-owned immutable assets may enter the shared optimizer. Payload
  // /api/media/file URLs can change permissions and must always bypass it.
  images: { localPatterns: [{ pathname: '/images/**', search: '' }], remotePatterns: [] },
  // Private pages: never cached by browsers, proxies or the CDN; never indexed.
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ] },
      ...(process.env.CSP_ENABLED === 'false' ? [] : [{ source: '/admin/:path*', headers: [{
        key: process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
        value: contentSecurityPolicy({ admin: true }),
      }] }]),
      // File visibility can change at any time; authenticated responses must
      // never be retained by a browser or shared proxy under the same URL.
      { source: '/api/media/file/:path*', headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      ] },
      {
        source: '/:locale(tr|en)/:section(hesap|account)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
