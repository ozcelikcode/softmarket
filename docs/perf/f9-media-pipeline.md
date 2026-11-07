# F9 görsel pipeline doğrulaması — 2026-11-07

`thumb=400`, `card=768`, `hero=1280`, `wide=1920`; WebP kalite 74. Genişlikler kaynak oranını korur. Payload 3.85.1'de `withoutEnlargement: undefined` daha büyük hedefi **atlıyor**; `true` ise kaynak boyutunda gereksiz dosya üretiyor. 500 px fixture yalnız 400 px dosya üretti. Admin crop/focal point açık; CSS kırpması focalX/Y'yi kullanır. Crop ve 0/100 kenar odak koordinatları gerçek Payload testinde doğrulandı.

MediaImage erişim kontrolünden geçmiş, populate edilmiş ilişkiyi tüketir; ID/filename'dan URL türetmez. Native `img` doğrudan Payload endpoint'ini kullanır, shared Next optimizer'a girmez. Boyut metadatası olmayan eski kayıt orijinale döner. Srcset WebP adaylarından sıralanır; `width/height`, lazy varsayılanı, ilk hero için eager/high ve responsive preload vardır. Container'ın 20/32 px yatay boşlukları ve CMS hero genişliği/grid aralığı sizes hesabına dahildir. Bloklar, kartlar, rich text, logo duvarı ve header görselleri ortak bileşeni kullanır.

## Erişim kanıtı

DB kopyası + izole uploads + `.next-prod` / 3200 üzerinde public, protected ve licensed üç medya, her birinde orijinal + dört boyut, anonim/customer/staff: **45 HTTP kontrolü**. Public herkese 200; protected/licensed anonim ve lisanssız müşteriye 404, staff'a 200. Tüm dosya yanıtları `private, no-store`. Next optimizer üzerinden protected URL isteği 400. Gerçek Payload handler + SQLite testleri ayrıca geçerli lisansla 200 ve lisans iptalinden sonra 404 davranışını doğrular.

Static filename sorgusu `filename OR sizes.<ad>.filename` ile **aynı medya kaydına** ve mevcut `mediaRead` lisans/download filtresine bağlanır. Endpoint kendi access sorgusunu da uygular; diskten doğrudan public servis yoktur.

F8 HTTP regresyonu: kopyadaki landing sayfasının taslağı protected medya içerir. Staff + draft, protected srcset'i görür ve yanıt private/no-store'dur. Draft çerezi tek başına, customer + draft ve anonim draftsız istek yalnız public/yayınlı görseli görür. Sonraki anonim yanıt da protected URL içermez.

## Boyut ve performans

Canlı DB'de medya sayısı 0; ölçüm **sentetik dokulu 2400×1600 fixture** üzerindedir. Kalite 78'de 1280 px çıktı 206548 bayt olduğu için kalite 74 seçildi.

| Ekran / DPR | sizes slot | Beklenen aday | HTTP dosya boyutu |
|---|---:|---:|---:|
| 390 px / 1 | 350 px | 400 px | 1240 bayt |
| 390 px / 2 | 350 px | 768 px | 23280 bayt |
| 390 px / 3 | 350 px | 1280 px | 171172 bayt |

Adaylar yayınlanan HTML'in sizes/srcset sözleşmesinden hesaplandı; tarayıcı `currentSrc` ölçümü değildir. Fixture mobil bütçesi ≤180 KB; bu değer her olası içerik/ekran için otomatik dosya boyutu garantisi değildir.

Sıcak production istekleri (5 örnek, medyan yanıt başlığı süresi): /tr 2.48 ms, /en 2.39 ms, /tr/urunler 17.16 ms. Bunlar LCP ölçümü değildir.

**Açık kabul doğrulaması:** Yeni LCP/CLS ve gerçek tarayıcı aday seçimi ölçülemedi. Chromium/Playwright macOS `MachPortRendezvousServer: Permission denied (1100)` ile açılmadı; Lighthouse debugging port beklerken başarısız oldu. Mevcut tarayıcı bağlantısı `browser access host is unavailable`; WebKit de başlatılamadı. Bu nedenle **LCP regresyonu yoktur iddiası yapılmıyor**. F0/F2 eski ölçümleri yeni F9 ölçümü yerine kullanılmadı. İzinli tarayıcı ortamında aynı 3200 build için Lighthouse ve currentSrc kontrolü tekrar çalıştırılmalı.

## Migration ve regenerate

`20261107_192347_media_image_sizes`: up yalnız 24 ADD COLUMN + 4 CREATE INDEX. focalX/Y zaten vardı. Down yalnız kendi indeks/sütunlarını düşürür; üretilen down'da tablo yeniden kurulumu yok, elle yeniden yazılması gerekmedi. Gerçek transaction down/up testi medya, locale ve ilişki satırlarını korur; FK kontrolü temiz.

Önce scratchpad `f9-copy.db` üzerinde oluşturuldu/uygulandı. Canlı öncesi `softmarket-pre-f9.db`, `-wal`, `-shm` ve tutarlı `.snapshot.db` yedekleri alındı; ardından `pnpm migrate` uygulandı. Snapshot ile canlıdaki eski satır/sütun değerleri birebir aynı; integrity_check=ok, FK ihlali=0.

`pnpm media:regenerate` raster medyayı sayfalı ve sıralı işler; büyük hedefler üretilmez. Tam ve diskte mevcut çıktıları atlar. Türevleri 0700 geçici dizinde üretir, 0600 izinle yeni rastgele adlara taşır ve ardından veritabanı referanslarını günceller; orijinal dosyayı yeniden yazmaz. Başarısızlıkta yüklenmiş yeni dosyalar temizlenir; işlem zorla sonlandırılırsa sahipsiz dosyalar kalabilir. Eski türevler eşzamanlı istemciler için silinmez ve ayrıca disk temizliği gerekebilir. Aynı kayıt işlem sırasında değişirse güncelleme reddedilir. Symlink ve kök dışına çıkan dosya yolları reddedilir. Türevlerde EXIF/GPS tutulmaz. **Özgün dosya metadata riski yeni yüklemeler için kapatıldı:** Media `beforeOperation` hook'u create/update sırasında JPEG/PNG/WebP/TIFF/HEIC/HEIF dosyasını Payload özgünü ve türevleri işlemeden önce sharp ile yönünü uygulayarak yeniden kodlar. EXIF (GPS dahil), XMP ve IPTC atılır; yalnız ICC korunabilir. JPEG q90/mozjpeg, PNG kayıpsız, WebP kayıpsız ve TIFF LZW kullanılır; format ve uzantı korunur. HEIC için HEVC destekli libvips gerekir; destek/çözümleme/kodlama veya metadata kontrolü hatası HTTP 400 ile reddedilir. SVG/GIF/video/PDF bu hook tarafından değiştirilmez. Mevcut dosyalar taranmaz/yeniden yazılmaz; regenerate özgün dosyayı korumaya devam eder. Testler geçici SQLite ve uploads dizininde GPS EXIF + XMP içeren JPEG'in kaydedilen özgününde metadata yokluğunu, fiziksel yönü ve 40×80 boyutları; PNG/WebP/TIFF temizliğini, geçici dosyadan replacement upload'u ve hata halinde dosya/kayıt oluşmadığını doğrular.

`generate:types`, `generate:importmap`, typecheck, lint, 47 dosya / 591 test ve production build başarılı. Import schema'nın medya giriş sözleşmesi değişmedi. /tr, /en, /tr/urunler, /admin 200; /tr/olmayan 404. Test fixture'ları yalnız DB kopyasındadır. 3200 kapatıldı (ECONNREFUSED); 3100 portu açık, `.next` korunmuştur; commit yok.
