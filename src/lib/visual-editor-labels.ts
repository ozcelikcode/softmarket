/*
 * V5 "Görsel düzenle" labels (TR/EN). Dependency-free leaf module so the staff-only canvas bridge chunk does not
 * pull the whole admin dictionary; re-exported by `src/lib/admin-i18n.ts` (single dictionary for editors) and
 * audited by tests/unit/admin-labels.test.ts.
 */
type L = { tr: string; en: string }
const loc = (tr: string, en: string): L => ({ tr, en })

export const VISUAL_EDITOR_LABELS = {
  canvas: {
    region: loc('Görsel düzenleyici', 'Visual editor'),
    toolbar: loc('Blok araçları', 'Block tools'),
    up: loc('Yukarı taşı (Alt+↑)', 'Move up (Alt+↑)'),
    down: loc('Aşağı taşı (Alt+↓)', 'Move down (Alt+↓)'),
    drag: loc('Sürükleyerek taşı', 'Drag to move'),
    duplicate: loc('Çoğalt', 'Duplicate'),
    hide: loc('Gizle', 'Hide'),
    show: loc('Göster', 'Show'),
    remove: loc('Sil', 'Delete'),
    confirmRemove: loc('Silinsin mi?', 'Delete it?'),
    add: loc('+ Blok ekle', '+ Add block'),
    edit: loc('Metni düzenle (Enter)', 'Edit text (Enter)'),
    hiddenBadge: loc('Gizli: ziyaretçiler görmez', 'Hidden: visitors do not see it'),
    required: loc('Zorunlu bölüm', 'Required section'),
    selected: loc('Seçili blok', 'Selected block'),
    fallback: loc(
      'Bu dilde metin yok; yedek metin gösteriliyor. Yazdığınız bu dile kaydedilir.',
      'No text in this language; the fallback is shown. What you type is saved to this language.',
    ),
    tooLong: loc('Metin en çok 1000 karakter olabilir.', 'Text is limited to 1000 characters.'),
    formOnly: loc('Bu metni form panelinden düzenleyin (çok satırlı veya uzun).', 'Edit this text in the form panel (multi-line or long).'),
  },
  notices: {
    cannotDuplicate: loc('Bu bölüm çoğaltılamaz.', 'This section cannot be duplicated.'),
    cannotHide: loc('Bu bölüm gizlenemez.', 'This section cannot be hidden.'),
    cannotRemove: loc('Bu bölüm silinemez (Teklif İste zorunlu).', 'This section cannot be deleted (Request a quote is required).'),
    heroFirst: loc('Ürün girişi her zaman ilk bloktur.', 'The product hero always stays first.'),
    invalid: loc('Bu işlem uygulanamadı; sayfa yenileniyor.', 'This action could not be applied; the page is refreshing.'),
    materialized: loc('Ürün bölümleri düzenlenebilir bloklara dönüştürüldü.', 'Product sections are now editable blocks.'),
    locale: loc('Dil değişti; önizleme yenileniyor.', 'The language changed; the preview is refreshing.'),
  },
  bar: {
    label: loc('Görsel düzenleyici araçları', 'Visual editor tools'),
    visual: loc('Görsel düzenle', 'Visual editing'),
    classic: loc('Klasik forma geç', 'Switch to classic form'),
    undo: loc('Geri al', 'Undo'),
    redo: loc('Yinele', 'Redo'),
    device: loc('Önizleme genişliği', 'Preview width'),
    fit: loc('Sığdır', 'Fit'),
    language: loc('İçerik dili', 'Content language'),
    saving: loc('Kaydediliyor…', 'Saving…'),
    saved: loc('Taslak kaydedildi', 'Draft saved'),
    saveError: loc('Taslak kaydedilemedi veya kayıt sırasında değişti; dil değiştirilmedi. Tekrar deneyin.', 'The draft could not be saved or changed during saving; the language was not switched. Try again.'),
    unsaved: loc('Kaydedilmemiş değişiklik', 'Unsaved changes'),
    help: loc('İpuçları', 'Tips'),
    publishHint: loc('Yayınlamak için sağdaki “Değişiklikleri yayınla” düğmesini kullanın.', 'Use “Publish changes” on the right to publish.'),
    conflict: loc(
      'Bu belge başka bir yerde değişti (MCP, başka sekme veya kullanıcı). Sizin son değişikliğiniz kaydedilmedi ama ekranda duruyor; diğer değişiklik ezilmedi.',
      'This document changed elsewhere (MCP, another tab or user). Your latest change was not saved but is still on screen; the other change was not overwritten.',
    ),
    merge: loc('Birleştir ve kaydet', 'Merge and save'),
    copy: loc('Değişikliklerimi kopyala', 'Copy my changes'),
    reload: loc('Yeniden yükle', 'Reload'),
    reloadLoses: loc('Yeniden yüklenince kaydedilmemiş değişiklikleriniz kaybolur. Devam edilsin mi?', 'Reloading discards your unsaved changes. Continue?'),
    merged: loc('Güncel sürümle birleştirildi; otomatik kaydedilecek.', 'Merged with the latest version; it will autosave.'),
    mergedBoth: loc('İki tarafta da değişen alanlarda sizinki kaldı', 'Fields changed on both sides kept your version'),
    mergeConflicts: loc('Birleştirme kaydedilmedi; çakışan alanları kopyalayıp yeniden yükleyin', 'Merge was not saved; copy the conflicting fields and reload'),
  },
  palette: {
    title: loc('Blok ekle', 'Add block'),
    search: loc('Blok ara', 'Search blocks'),
    close: loc('Kapat', 'Close'),
    empty: loc('Eşleşen blok yok.', 'No matching block.'),
    other: loc('Diğer', 'Other'),
  },
  tour: {
    next: loc('İleri', 'Next'),
    back: loc('Geri', 'Back'),
    done: loc('Başla', 'Start'),
    close: loc('Turu kapat', 'Close tour'),
    step: loc('Adım', 'Step'),
    steps: [
      [
        loc('Sayfayı yerinde düzenleyin', 'Edit the page in place'),
        loc(
          'Önizlemede bir bloğa tıklayın: seçilir ve formdaki ayarları açılır. Seçili bloktaki bir metne tekrar tıklayıp yazın; Enter kaydeder, Esc vazgeçer.',
          'Click a block in the preview: it is selected and its settings open in the form. Click a text in the selected block again and type; Enter keeps it, Esc cancels.',
        ),
      ],
      [
        loc('Blokları taşıyın ve ekleyin', 'Move and add blocks'),
        loc(
          'Seçili bloğun araç çubuğuyla yukarı/aşağı taşıyın, tutamaçtan sürükleyin, çoğaltın, gizleyin veya silin. “+ Blok ekle” görselli blok listesini açar. Klavye: ↑/↓ seç, Alt+↑/↓ taşı.',
          'Use the selected block’s toolbar to move it up/down, drag it by the handle, duplicate, hide or delete it. “+ Add block” opens the visual block list. Keyboard: ↑/↓ select, Alt+↑/↓ move.',
        ),
      ],
      [
        loc('Görünüm, Hareket ve medya formda', 'Appearance, motion and media in the form'),
        loc(
          'Soldaki dar form paneli seçili bloğun Görünüm ve Hareket ayarlarını, görselleri, zengin metni ve bağlantıları gösterir. Tüm kayıtlar bu formdan ve sunucu doğrulamasından geçer.',
          'The narrow form panel on the left shows the selected block’s Appearance and Motion settings, images, rich text and links. Every change goes through this form and server validation.',
        ),
      ],
      [
        loc('Önizle, çevir, yayınla', 'Preview, translate, publish'),
        loc(
          'Üst çubukta 390/768/1440 genişliği, TR/EN dili ve geri al/yinele var. Değişiklikler taslak olarak otomatik kaydedilir; ziyaretçiler “Değişiklikleri yayınla” ile görür. Klasik forma tek tıkla geçebilirsiniz.',
          'The top bar has 390/768/1440 widths, TR/EN language and undo/redo. Changes autosave as a draft; visitors see them after “Publish changes”. Switch to the classic form with one click.',
        ),
      ],
    ],
  },
} as const

export type VisualEditorLabels = typeof VISUAL_EDITOR_LABELS
/** Pick the admin-language string. */
export const t = (label: L, lang: string): string => (lang === 'en' ? label.en : label.tr)
