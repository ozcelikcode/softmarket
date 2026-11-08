# Native canvas: what-digital spike — 2026-11-08

## Karar: REDDEDİLDİ (KALIR)

> Sonuç: eklenti worktree'den kaldırıldı; V3b özel köprü ile yapıldı (`canvas.md`).

1.0.1 iki yönlü `origin` **ve** `source` kontrolü güvenlik kapısını karşılamıyor. Kurulu paketin `SiteBridge` testinde farklı origin reddedildi, fakat aynı origin'den parent olmayan bir pencerenin `hello` mesajı kabul edildi (`connected = true`). Bu, tek başına yetkisiz yazma veya veri erişimi kanıtı değildir: admin tarafı ayrıca iframe kaynağı ve session ID doğrular. Yine de planın açık kapısı sağlanmıyor. Özel V3b Argon köprüsüne geçilsin; bu spike köprüyü uygulamaz.

Kaynaklar: [site bridge](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/packages/core/src/bridge.ts), [admin bridge](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/packages/plugin/src/utils/adminBridge.ts). README'nin iki yönde source kontrolü iddiası site koduyla uyuşmuyor.

Admin eklentisi yalnız `products` için kayıtlı; frontend SDK ve işaretleme bağlanmadı. Dolayısıyla bu worktree çalışır canvas demosu değildir. Editörde round-trip, Lexical, çok dilli akış ve tam entegrasyonun bundle sonuçları doğrulanmadı. Chromium sandbox izin hatasıyla açılmadı; güvenlik kusuru zaten zorunlu eleme nedenidir.

## Paket ve bakım

- [MIT lisansı](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/LICENSE): fork mümkün, telif ve lisans bildirimi korunmalı. İncelenen ve npm'den tam sabitlenen paketler `payload-inline-visual-editor@1.0.1` ve `@payload-inline-visual-editor/react@1.0.1`; core 1.0.1. npm `latest` 1.0.1 (2026-07-20 13:12:26 UTC); [ilk kamu sürümü 2026-07-20](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/CHANGELOG.md); 1.0.0 geri çekilmiş. İncelenen upstream HEAD `85e055e51d8c8e4128aa4c3ef2808dee9c2bd850`.
- Peer aralıkları Payload/UI `^3.85.0`, Next `^15.2.9 || ^16.0.0`, React/React-DOM `^19.0.0`: kurulu 3.93.0 / 15.4.11 / 19.2.6 aralık içinde; build ve typecheck geçti, çalışma zamanı uyumluluğu bütünüyle kanıtlanmadı.
- Upstream `packages/{plugin,core,react}/src`: 35 dosya, yaklaşık 4.603 TS/TSX satırı. Kod modüler ve okunabilir; form API'si, drawer, `RenderFields`, Live Preview gibi Payload UI export'ları tek `payload-internals.ts` varilinde toplanmış. Derin UI import'larından kaçınıyor ama admin form/state ve bileşen sözleşmelerine sıkı bağımlı; Payload yükseltmelerinde regresyon/fork bakımı gerekir. İlk kamu sürümü olduğundan olgunluk kanıtı sınırlı.
- Site SDK'sının `configurePayloadEditable` işlevi modül genelinde değişken kullanır; README'deki istek başına draft ile ayarlama eşzamanlı SSR istekleri arasında durum paylaşma riski taşır. Yarış dinamik olarak test edilmedi; entegrasyonda request-local açık bayrak kullanılmalı. SDK client modülünün public JS yasağına uyumu ayrıca çözülmelidir.

## Kapılar ve kanıt

| Kapı | Sonuç |
|---|---|
| Editörde round-trip / Lexical | **Doğrulanamadı.** Chromium başlatma `MachPortRendezvous ... Permission denied` ile SIGTRAP; SDK/DOM işaretleme bağlanmadı. Kopya DB'de boş içerikli kompozisyon ürününün TR ve EN `layout`'u Local API ile okunup değişmeden yayınlı kaydedildi, derin karşılaştırma geçti. Bu editör testi değildir; ana sayfa, Lexical node JSON ve boş EN fallback yazılmaması test edilmedi. |
| İşlemler ve TR/EN | **Kısmi.** Kurulu `planBlockOp` add/duplicate/remove/move için beklenen indeksleri üretti. Local API ile izole ürün draft'ına `spacer` eklendi, çoğaltıldı, silindi ve `productEditions` taşındı; EN başlık değişiminde TR başlık değişmedi. Eklenti formu üzerinden yapılmadı; locale değiştirme ve draft'tan yayın UI akışı doğrulanmadı. Tekil `productNav` çoğaltma 400 aldı. |
| V2 | **Sunucu sınırı geçti.** Kopya DB'de `productEditions` çıkarılması normal, draft ve autosave yazımında 400; sona taşınan hero sunucuda ilk sıraya normalize edildi. `product-composition` ve `live-preview` birim testleri 60/60 geçti. Eklenti planlayıcısı editions silme isteğini planlıyor; sunucu reddi korunuyor. |
| Güvenlik | **KALIR.** Site bridge yanlış source'u kabul ediyor; admin bridge origin/source/session denetliyor ve hedef origin açık. `/api/preview?redirect=/tr` anonim HTTP 401 ve `private, no-store, max-age=0`. `/admin/visual-editor/products/1` anonim HTTP 200 döndürdü; yetkisiz editör içeriğinin yokluğu ve customer/draft no-store uçtan uca ayrıca doğrulanmadı. Mevcut preview uygulaması değiştirilmedi. |
| Public bundle | **Doğrulanamadı / ölçülen ham toplam eşik üstünde.** Admin eklentisi kayıtlı, SDK bağlanmamış build başarılı. `/tr` HTML'indeki 13 script'in her biri gzip'lenip toplandığında 161.565 bayt (~157,8 KiB); `payload-inline-visual-editor`, `payload-visual-editor`, `data-pve-` işaretleri bu scriptlerde yok. Bu yöntem önceki Lighthouse aktarım metriğiyle birebir karşılaştırılamaz ve SDK'yı içermeyen entegrasyonu ölçer; ≤130 KB kapısı geçmedi kabul edilir, tam entegrasyonda Lighthouse ve bütün frontend chunk'ları ayrıca ölçülmeli. |
| MCP/import | **Doğrulanamadı.** Editörden kayıt olmadığı için sonrası MCP find ve import dry-run yapılmadı. |

`NEXT_DIST_DIR=.next-pilot-canvas PORT=3520 pnpm build` ve `pnpm typecheck` başarılı. 3520 üzerinde `/tr`, `/en`, `/admin` 200 ve anonim preview 401 görüldü. Sunucu iş bitiminde kapatıldı. Kopya DB `sqlite3 .backup` ile oluşturuldu ve `integrity_check = ok`. Migration çalıştırılmadı, uploads gerekmedi, ana repo sunucusuna HTTP isteği yapılmadı. Test ürünleri yalnız kopyadadır.

## Payload 3.93.0 admin form API'si

Doğrudan `node_modules/@payloadcms/ui/dist/forms/Form/{context,types}.d.ts`, `forms/useField/{index,types}.d.ts` ve `dist/exports/client/index.d.ts` incelendi. Bunlar `@payloadcms/ui` client export'larıdır:

```ts
useForm(): Context
useDocumentForm(): Context // iç içe formdan belge formuna
useAllFormFields(): [FormState, React.Dispatch<FieldAction>]
useFormFields<T = unknown>(selector: (context: [FormState, React.Dispatch<FieldAction>]) => T): T
// Context:
addFieldRow(args: { path: string; schemaPath: string; blockType?: string; rowIndex?: number; subFieldState?: FormState }): void
moveFieldRow(args: { path: string; moveFromIndex: number; moveToIndex: number }): void
removeFieldRow(args: { path: string; rowIndex: number }): void
dispatchFields: React.Dispatch<FieldAction>
setModified(modified: boolean): void
// FieldAction seçeneklerinden:
{ type: 'DUPLICATE_ROW'; path: string; rowIndex: number }
{ type: 'UPDATE'; path: string } & Partial<FormField> // value dahil
useField<T>(options?: Options): FieldType<T> // setValue(val: unknown, disableModifyingForm?: boolean): void
```

`useForm().fields` bayat olabilir; tip dosyası `useFormFields` önerir. Satır ID'sini güncel state'ten çözüp indeksleri doğrulamak, `schemaPath` ve değiştirilmiş/validasyon durumunu yönetmek, form dispatch sonrası sunucu erişim/doğrulama zincirini korumak gerekir. Bu imzalar kaynak doğrulamasıdır; özel köprünün çalışma testi değildir.
