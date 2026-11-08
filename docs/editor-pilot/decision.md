# Görsel editör kararı (V4) — 2026-11-08

**Karar:** Payload-native canvas (özel köprü). Puck pilotu (`pilot/puck`) bırakıldı; arşiv etiketi `archive/pilot-puck`.

## Gerekçe

- **Kullanıcı denemesi:** 3 admin deneyimi içinde görsel düzenlemeyi en çok beğenen seçenek native canvas oldu. Kullanıcı yorumu: "Payload altyapısında kalsın".
- **Yayın eşdeğerliği:** canvas tuvali yayınla %100 piksel eşdeğer.
- **Public bundle:** +0,17 KB (129,42 → 129,59 KB). Puck izi public tarafta 0 idi, ama native çözüm de public'e ek yük bırakmıyor.
- **Efor:** V5 tahmini 6–8 gün (Puck ~12 gün).
- **Bağımlılık:** native yolda yeni çalışma zamanı bağımlılığı yok. Puck 0.x ve yaklaşık 60 ek paket getirirdi.
- **Veri:** dönüşüm yok. Kayıtlar Payload `layout` yapısında kalır.

## Puck pilotunun durumu

- Tüm kapılar geçti: round-trip 0 fark, bundle izi 0.
- Ancak canvas eşdeğerliği %79. MCP/import kapısı o anda açıktı; sonradan karar b ile çözüldü (commit `f8c7f34`).
- Gerekçe yine de native yönünde: bağımlılık ve efor farkı, Puck'un kazandığı kapılardan daha ağır bastı.

## Ek kullanıcı kararları

- Görsel editör ürün ve sayfa açılınca varsayılan görünüm olacak.
- Form dar yan panel olarak kalacak. Form silinmez: medya, zengin metin, ilişki ve tüm yazım form → sunucu doğrulamasından geçer.
- `what-digital` eklentisi reddedildi: postMessage kaynak (source) kontrolü yok.

## Raporlar

- Puck: `docs/editor-pilot/puck.md`, `docs/editor-pilot/puck-metrics.json`
- Canvas: `docs/editor-pilot/canvas.md`, `docs/editor-pilot/canvas-metrics.json`, `docs/editor-pilot/canvas-spike.md`

## Sonraki adım

V5 (`feat/visual-editor` dalı): native canvas'ın tam uygulaması, 8 görev kabul testi ve admin'de "Görsel düzenle" yalnız staff'a görünür.
