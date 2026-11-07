import { emailLocale as localeOf, emailTemplate } from '@/lib/email/template'
import { localizedHref } from '@/i18n/paths'

type Locale = 'tr' | 'en'
const origin = () => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://127.0.0.1:3100')
    return ['https:', 'http:'].includes(url.protocol) ? url.origin : 'http://127.0.0.1:3100'
  } catch {
    return 'http://127.0.0.1:3100'
  }
}

const COPY = {
  tr: {
    verifySubject: 'SoftMarket e-posta adresinizi doğrulayın',
    verifyBody: 'Hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın.',
    verifyAction: 'E-postamı doğrula',
    resetSubject: 'SoftMarket şifre sıfırlama',
    resetBody: 'Şifrenizi sıfırlamak için bağlantıyı kullanın. Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.',
    resetAction: 'Şifremi sıfırla',
  },
  en: {
    verifySubject: 'Verify your SoftMarket email address',
    verifyBody: 'Verify your email address to activate your account.',
    verifyAction: 'Verify my email',
    resetSubject: 'SoftMarket password reset',
    resetBody: 'Use the link to reset your password. If you did not request this, you can ignore this message.',
    resetAction: 'Reset my password',
  },
} as const

function html(locale: Locale, path: string, token: string, body: string, action: string) {
  const link = `${origin()}${localizedHref(`${path}?token=${encodeURIComponent(token)}`, locale)}`
  return emailTemplate({ locale, title: action, body, action: { label: action, url: link } })
}

type EmailArgs = { token?: string; user?: unknown } | undefined

export const verifyEmailSubject = ({ user }: EmailArgs = {}) => COPY[localeOf(user)].verifySubject
export const verifyEmailHTML = ({ token = '', user }: EmailArgs = {}) => {
  const locale = localeOf(user)
  return html(locale, '/hesap/dogrula', token, COPY[locale].verifyBody, COPY[locale].verifyAction)
}
export const resetEmailSubject = ({ user }: EmailArgs = {}) => COPY[localeOf(user)].resetSubject
export const resetEmailHTML = ({ token = '', user }: EmailArgs = {}) => {
  const locale = localeOf(user)
  return html(locale, '/hesap/sifre-sifirla', token, COPY[locale].resetBody, COPY[locale].resetAction)
}
