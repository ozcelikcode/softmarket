/**
 * Custom server validation messages, served through `req.t('softmarket:<key>')` (registered in payload.config
 * `i18n.translations`). Turkish is the admin fallback language.
 */
export const VALIDATION_TRANSLATIONS = {
  tr: { softmarket: {
    globalDraftStatusWithoutDraft: 'Taslak durumu yalnız taslak kaydıyla yazılabilir (draft: true). Yayındaki içeriği değiştirmek için _status: "published" gönderin; site çerçevesi yayından kaldırılamaz.',
    globalDraftRestore: 'Yalnız yayınlanmış bir sürüm geri yüklenebilir ve geri yükleme yayınlar; taslak olarak geri yükleme desteklenmez.',
    linkUrlInvalid: 'Geçersiz adres: yalnız https://, http://, mailto:, tel: ya da / ile başlayan site içi yol kullanılabilir (javascript:, data:, vbscript: ve // kabul edilmez).',
  } },
  en: { softmarket: {
    globalDraftStatusWithoutDraft: 'Draft status can only be written by a draft save (draft: true). Send _status: "published" to change live content; the site chrome cannot be unpublished.',
    globalDraftRestore: 'Only a published version can be restored, and restoring publishes it; restoring as draft is not supported.',
    linkUrlInvalid: 'Invalid address: use https://, http://, mailto:, tel: or a site path starting with / (javascript:, data:, vbscript: and // are rejected).',
  } },
} as const

export type ValidationMessageKey = keyof typeof VALIDATION_TRANSLATIONS.en.softmarket

/** Translated message; falls back to English when no translator is available (e.g. a bare validate call). */
export function validationMessage(req: { t?: (key: never) => string } | undefined, key: ValidationMessageKey): string {
  const translated = req?.t?.(`softmarket:${key}` as never)
  return translated && translated !== `softmarket:${key}` ? translated : VALIDATION_TRANSLATIONS.en.softmarket[key]
}
