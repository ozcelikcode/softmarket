# SoftMarket Editör Kılavuzu (Türkçe ek)

Bu dosya Türkçe bölümleri içerir; ana kılavuz için bkz. `editor-guide.md`.

## Lisanslar ve güvenlik merkezi

Bu bölüm yalnızca yöneticiler içindir. Editörler lisansları, cihazları veya güvenlik merkezini açamaz.

### Nerede?

- **Lisanslar:** yönetim panelinde `licenses` koleksiyonu. Bir lisansı açınca durumu, nedeni, kaynağı, son değişikliği ve cihazları görürsünüz.
- **Lisans işlemleri:** lisans belgesinin yan panelindeki "Lisans işlemleri". Durum alanı formda salt okunurdur. Panel işlemleri, ödeme işlemleri ve kural motoru lisans durumunu değiştirebilir.
- **Cihazlar:** `license-activations` koleksiyonu ve Lisans işlemleri panelindeki cihaz listesi (etiket, platform, IP öneki, son görülme).
- **Güvenlik merkezi:** `/admin/guvenlik` (menüde "Güvenlik merkezi"). Genel bakış, olaylar, engeller, durum değişiklikleri ve imza anahtarları sekmeleri vardır. Denetim izi ve ayarlar kendi yönetim ekranlarını açar.
- **Lisans ayarları:** yönetim panelindeki `licensing-settings` global ayarı (yalnızca yönetici).

### Lisans üzerindeki eylemler

- **Askıya al:** aktif → askıda. Neden zorunludur. Müşteri askı e-postası ayarı açıksa müşteriye e-posta gider. Geri al ile geri döndürülebilir.
- **İptal et:** aktif veya askıda → iptal. Neden zorunludur ve lisans kimliğinin son altı karakterinin yazılması gerekir. Tüm aktif cihazlar "lisans iptal edildi" nedeniyle serbest bırakılır. İptal kesindir; geri alınamaz.
- **Geri al:** yalnızca son askının kural askısı veya elle yapılmış yönetici askısı olması halinde geri alır. Diğer durumlarda reddedilir.
- **Yeniden etkinleştir:** Geri al'ın kapsamadığı kalan askıları kaldırır (ör. kazanılmış bir ödeme itirazı). Kural veya elle askılar için Geri al kullanın.
- **Cihazı serbest bırak:** koltuğu boşaltır; cihaz durumu "deaktif" olur. Lisans durumu değişmez.
- **Cihazı iptal et:** cihazı yönetici işlemiyle sonlandırır. Cihazın yeniden etkinleşmesini engellemek için engel (parmak izi engeli) ekleyin.

Her işlem gerekçe ister; lisans değişikliklerinde bir durum geçmişi satırı ve bir denetim satırı yazılır. Aynı istek kimliğiyle yapılan tekrar istek yeni bir kayıt oluşturmaz.

### Güvenlik olayları ve inceleme

- **Onayla:** açık olayı görüldü olarak işaretler.
- **Çözüldü:** olayı kapatır.
- **Yanlış alarm:** olayı yanlış alarm olarak işaretler. Kural askısı için "Yanlış alarm + geri al" lisansı da geri açar.
- Açık "kural devre kesici açıldı" olayının herhangi bir incelemesi devre kesiciyi erken kapatır.

### Engeller

- IP öneki (IPv4 için /24, IPv6 için /48), CIDR aralığı, cihaz, parmak izi veya lisans için engel ekleyin.
- Süreler: 1 saat, 24 saat, 7 gün veya bitiş tarihi olmadan (yalnızca yönetici).
- Engel kendi güvenilir adresinizi kapsıyorsa ayrıca onaylamanız gerekir.
- Kaldır engeli devre dışı bırakır. Kayıt saklama temizliğine kadar korunur. İşlemi yapan süreç değişikliği hemen alır. Diğer süreçler engel önbellekleri dolduğunda güncellenir.

### İmza anahtarı döndürme

- "İmza anahtarları" sekmesi etkin anahtar kimliğini ve döndür düğmesini gösterir.
- Döndürme için `DÖNDÜR` veya `ROTATE` yazılması gerekir.
- Eski anahtarlar 90 gün doğrulamaya devam eder. Bir anahtarın iptali doğrulamayı hemen sonlandırır.
- Ortam değişkeniyle tanımlanan anahtarlar panelden döndürülemez.

### Yalnızca izleme modu ve otomatik kurallar

- Kurallar dört moddan birinde çalışır: kapalı, gözlem, bildirim, askıya alma. Yeni kurallar **bildirim** modunda başlar.
- Otomatik askı yalnızca **askıya alma** modunda yapılabilir. Otomatik işlemler hiçbir zaman lisansı iptal etmez.
- Otomatik askı, **kurallar → observeUntil** tarihi geçene kadar engellenir. Bu süre boyunca olası askı kaydedilir ve bildirilir.
- observeUntil tarihini yalnızca izleme döneminin olaylarını inceledikten sonra geçmiş bir tarihe ayarlayın.

### Devre kesici

- **Saatte en fazla otomatik askı** (varsayılan 5). Bu sınırın üzerindeki askı yürütülmez. Kritik bir "kural devre kesici açıldı" olayı kaydedilir ve yönetici uyarısı gönderilir.
- Devre kesici açıkken askıya alma modundaki eşleşmeler yalnızca bildirilir. Olay incelenince ya da 24 saat sonra kapanır.
- Sınır 0 yapılırsa otomatik askı devre kesici açılmadan kapanır.

### Lisans ayarları (yönetim panelinde düzenlenir)

- **Genel:** API açık/kapalı, genel ana makine, kira süresi gün olarak (varsayılan 14, en fazla 30), yenileme ve saat sapması değerleri.
- **Limitler:** API için istek ve hız sınırı eşikleri.
- **Kurallar:** her kuralın modu ve eşikleri, observeUntil tarihi ve devre kesici sınırı.
- **Self-servis:** portalın cihaz kaldırma kotası ve lisans API'sinin yeniden bağlama kotası.
- **Bildirim:** uyarı e-posta alıcıları, anlık önem eşiği, günlük özet, müşteri askı e-postaları.
- **Saklama:** her kayıt türünün ne kadar tutulacağı. Alt sınırlar kodda sabittir ve bunların altına inilemez.

Bu ayarlardaki değişiklikler denetim izine eski ve yeni değerleriyle yazılır. E-posta adresleri kayda yazılmaz.

### Sweep zamanlayıcısı

- `pnpm licensing:sweep` kural motorunu, bildirim kuyruğunu ve istenirse saklama temizliğini çalıştırır.
- Sunucuda `licensing-sweep` systemd zamanlayıcısı ile her 5 dakikada bir çalışır.
- Seçenekler: `--dry-run` kararları yazmadan ve göndermeden raporlar; `--retention` yalnızca temizlik yapar.
- Saklama temizliği 04:00 saatinde (Europe/Istanbul) çalışır.
