# Ödeme operasyonu (P6)

Bu belge ödeme modu açık bir kurulumun günlük işletimini anlatır. Plan ve tasarım kararları: `docs/plan-payments.md`.

## 1. Derleme ve başlatma: `PAYMENTS_ENABLED` iki yerde aynı olmalı

- `PAYMENTS_ENABLED=true` hem **derleme** (`pnpm build`) hem **çalışma** ortamında bulunmalıdır. `deploy.sh` `/etc/softmarket.env` dosyasını derlemeden önce yükler; elle derlerken aynı dosyayı yükleyin.
- Neden: yetenek açıkken tüm site sayfaları istek başına üretilir (ödeme durumu DB'den okunur, fiyat/yasal sayfa önbelleğe yazılmaz). Next.js bu kararı **derlemede** verir.
  - Yetenekle derlenip yeteneksiz başlatılırsa: site çalışır, ödeme yüzeyi kapalıdır (yalnız teklif).
  - Yeteneksiz derlenip yetenekle başlatılırsa: site çalışır ama ödeme yüzeyi **kapalı kalır** (yalnız teklif) ve logda bir kez `PAYMENTS_ENABLED is on but this build was prerendered without it` uyarısı çıkar. Yeniden derleyin.
- Yeteneği açmak ya da kapatmak = env değişikliği + yeniden derleme + yeniden başlatma.

## 2. Mutabakat zamanlayıcısı (reconcile)

`deploy/payments-reconcile.{service,timer}`: 15 dakikada bir `pnpm payments:reconcile`. Yetenek kapalıyken hiçbir şey yapmaz (çıkış 0).

```bash
sudo cp deploy/payments-reconcile.service deploy/payments-reconcile.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now payments-reconcile.timer
systemctl list-timers payments-reconcile.timer          # sonraki çalışma
journalctl -u payments-reconcile.service -n 50           # son çıktı (yalnız sipariş no + kısa kodlar)
sudo -u softmarket env $(grep -v '^#' /etc/softmarket.env | xargs) pnpm payments:reconcile --dry-run   # yazmadan önizleme
```

Her çalışmada sırayla:

1. 5 dakikadan eski `pending` siparişleri sağlayıcıdan okur; ödenmişse lisans atar, 60 dakikayı geçmiş ödenmemişse `cancelled` yapar.
2. Lisansı atanamamış `paid` siparişleri tamamlar.
3. **İade mutabakatı (P6):** sonucu belirsiz/beklemede kalan iadeleri sağlayıcıdan **yalnız okur** (ikinci iade isteği asla gönderilmez). Sağlayıcı iadeyi gösteriyorsa sipariş `refunded`, lisanslar `revoked`, müşteriye e-posta. Sağlayıcıda henüz görünmeyen denemede kilit süreye bağlı açılmaz; sağlayıcıyla araştırın.
4. Gönderilemeyen bildirimleri (sipariş onayı, lisans, iade, personel uyarısı) en fazla 5 deneme ve artan beklemeyle tekrar dener.

Hata varsa çıkış kodu 1 olur; systemd günlüğünde görünür.

## 3. Yönetici işlemleri (Sipariş belgesi → yan panel "Sipariş işlemleri")

Yalnız **admin** rolündeki kullanıcı, **panel oturumuyla** görür ve kullanabilir. Editör, müşteri, API anahtarı ve MCP bu işlemleri yapamaz (403); oturumsuz istek 401.

| Düğme | Ne zaman | Ne olur |
|---|---|---|
| İade et | `paid` / `fulfilled` | Önce sağlayıcıdan iade durumu okunur (zaten iade edildiyse yeni iade yapılmaz). Sonra **tam tutar** iade edilir (kısmi iade yok). Başarılıysa sipariş `refunded`, siparişin lisansları `revoked`, müşteriye iade e-postası. |
| İptal et | `pending` | Sağlayıcıdan durum okunur; ödeme alınmışsa iptal edilmez, sipariş güncellenir. Değilse Stripe oturumu kapatılır (iyzico'da formun süresi kendiliğinden dolar) ve sipariş `cancelled`. |
| Bildirimi yeniden gönder | 5 denemede bırakılmış ya da hata kodlu bildirim | Deneme sayacı sıfırlanır, bekleyen e-postalar hemen gönderilir. |

İade sonuçları:

- **Sağlayıcı reddetti:** para iade edilmedi, sipariş değişmedi; nedeni sağlayıcı panelinde kontrol edin. Tekrar denenebilir.
- **Bildirim teslimi:** SMTP gönderimi ile veritabanına teslim işareti yazılması arasında kesinti veya uzun gönderim olursa aynı e-posta tekrar gidebilir; tam olarak bir kez teslim garanti edilmez.
- **Sonuç belirsiz (zaman aşımı/ağ hatası):** iade **tekrar denenmez** (iyzico iadesinde tekrar koruması yok; çift iade riski). Sipariş "İnceleme gerekiyor" olur ve personel uyarısı gider. Mutabakat sağlayıcıyı tekrar okur; gerekirse sağlayıcı panelinden kontrol edin.
- **Beklemede (Stripe):** sağlayıcı onaylayınca webhook ya da mutabakat siparişi kapatır.

Her işlem siparişin **Notlar** alanına zaman damgalı bir satır ekler; ayrıca "Ödeme olayları" listesinde `admin.refund` / `notify.refund` kayıtları denetim izi olarak görünür.

## 4. Ödeme itirazı (chargeback)

- **Stripe:** `charge.dispute.created` webhook'u siparişin lisanslarını `suspended` (portalda "Askıda") yapar ve siparişi incelemeye alır. `charge.dispute.closed` lisansa dokunmaz; sonuca göre lisansı elle `active` ya da `revoked` yapın. `charge.refunded` (sağlayıcı panelinden yapılan iade) siparişi sağlayıcı durumunu okuyarak `refunded` yapar.
- **iyzico:** Checkout Form için itiraz/iade bildirimi belgelenmemiştir. İtiraz bankadan ya da iyzico panelinden gelir: lisansı admin'de elle `suspended` yapın, siparişe not düşün. Panelden yapılan iade için siparişte "İade et" deyin: sağlayıcı zaten iade edildiğini gösterir ve yeni iade yapılmadan sipariş kapanır.

## 5. Uyarı e-postaları

- Personel uyarısı (`requiresReview`: tutar uyuşmazlığı, geç ödeme, belirsiz iade, kısmi iade, itiraz) `PAYMENTS_ALERT_EMAIL` adresine gider. SMTP ya da adres yoksa yalnız loga sipariş no + kısa kod yazılır.
- Müşteri e-postaları (onay, lisans, iade) SMTP yoksa gönderilmez; konsol adaptörü kişisel veri loglayacağı için bilerek atlanır.

## 6. Fatura numarası

Faturayı kestikten sonra siparişteki **Fatura** grubuna numarayı ve tarihi girin; müşteri portaldaki sipariş sayfasında görür. Liste görünümünde durum, sağlayıcı, para birimi, inceleme ve tarih sütunları vardır; "Filtreler" ile bu alanlara göre süzebilir, sipariş no ya da sağlayıcı referansıyla arayabilirsiniz.
