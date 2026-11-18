# SoftMarket Editör Kılavuzu

Bu kılavuz, web sitesini yöneten editörler ve yöneticiler içindir. Teknik bilgi gerekmez. Adımlar yönetim paneli üzerinden yapılır.

---

## 1. Giriş

### Yönetim paneline giriş

1. Tarayıcıda şu adresi açın: **http://127.0.0.1:3100/admin**
2. E-posta ve şifrenizle giriş yapın.

### İlk yönetici hesabı

- Sistemdeki ilk kullanıcı otomatik olarak **yönetici (admin)** olur.
- Sonraki kullanıcıları yalnız yönetici ekleyebilir.
- Yönetici kendi hesabını da düzenleyebilir.

### Roller

| Rol | Ne yapabilir |
|---|---|
| **Yönetici (admin)** | Her şey: içerik, menü, site ayarları, kullanıcılar, lisanslar. |
| **Editör** | İçerik ekler, düzenler ve yayınlar; menü ve footer'ı düzenler. Personel kayıtlarını okuyabilir, kendi hesabını düzenleyebilir; kullanıcı ekleyemez/silemez, rolünü değiştiremez. Lisans ve Site ayarları yazma yetkisi yoktur. |

Müşteriler yönetim paneline giremez. Müşteri hesapları yalnız web sitesindeki müşteri alanında çalışır.

---

## 2. Ana sayfayı düzenleme

Ana sayfa, **Sayfalar** koleksiyonundaki bir kayıttır. Sayfa, bloklardan oluşur. Bloklar yukarıdan aşağıya sırayla görünür.

### 2.1 Sayfayı açma

1. Sol menüden **Sayfalar** bölümüne girin.
2. Slug değeri `home` olan sayfayı açın. Site ayarlarında başka bir ana sayfa seçiliyse onu açın.
3. Sayfa düzenleme ekranında **Sayfa blokları** alanını görürsünüz. Bloklar burada listelenir.

Ana sayfanın ilk **Giriş (Hero)** bloğu sayfanın başlığıdır. Bu bloğu sayfanın en üstünde tutun.

### 2.2 Blok ekleme

1. Blok listesinin altındaki **Blok ekle** düğmesine tıklayın. Belirli bir bloğun hemen altına eklemek için o bloğun sağındaki **···** menüsünden **Altına ekle** seçin.
2. Açılan pencere blokları gruplara ayırır: **Giriş, İçerik, Katalog, Kanıt, Dönüşüm, Yardımcı**.
3. İstediğiniz bloğu seçin. Bloğun önizleme görseli ve kısa açıklaması görünür.
4. Alttaki düğmeyle eklenen blok listenin sonuna, **Altına ekle** ile eklenen blok seçtiğiniz bloğun altına gelir. Sonra sürükleyerek yerini değiştirebilirsiniz.

### 2.3 Sıralama (sürükle-bırak)

- Her bloğun sol tarafındaki tutamaktan (altı nokta simgesi) tutun.
- Bloğu istediğiniz yere sürükleyip bırakın. Sürüklemek zor geliyorsa bloğun **···** menüsündeki **Yukarı taşı** / **Aşağı taşı** seçeneklerini kullanın.
- Sıra değişikliği de taslak olarak kaydedilir. Yayınlamadan canlı siteye gitmez.

### 2.4 Blok silme ve kopyalama

- Bloğun sağındaki **···** menüsünde şu seçenekler vardır: **Yukarı taşı**, **Aşağı taşı**, **Altına ekle**, **Çoğalt**, **Satırı kopyala**, **Satırı yapıştır**, **Kaldır**.
- **Çoğalt** bloğun bir kopyasını hemen altına ekler. **Kaldır** bloğu siler (menüde "Sil" yoktur).
- Sayfa ~2 saniyede otomatik taslak kaydettiği için kaldırılan blok kaydedilmiş olur. Geri almak için sayfanın **Sürümler** sekmesinden önceki sürümü geri yükleyin. Emin değilseniz önce **Bloğu gizle** kullanın (aşağıda).

### 2.5 Bloğu gizleme

Silmeden gizlemek için:

1. Bloğu açın.
2. **Görünüm** bölümünü açın.
3. **Bloğu gizle** kutusunu işaretleyin.

Gizli blok sitede görünmez, ama içeriği kaybolmaz. Tekrar göstermek için kutuyu kaldırın.

### 2.6 "Görünüm" ayarları

Her blokta **Görünüm** adlı bir bölüm vardır. Varsayılan ayarlar çoğu durumda yeterlidir. Ayarlar şunlardır:

| Ayar | Ne işe yarar | Seçenekler |
|---|---|---|
| **Tema** | Blok arka planının rengi. | Otomatik (blok varsayılanı), açık, koyu. |
| **Dikey boşluk** | Bloğun üstü ve altındaki boşluk. | Yok, küçük, orta, büyük. |
| **Hizalama** | Başlık ve metnin hizası. | Sola, ortala. |
| **Genişlik** | Blok içeriğinin genişliği. | Dar, normal (varsayılan), geniş. |
| **Animasyon** | Bloğun hareketinin ana anahtarı. **Yok** seçilirse **Hareket** bölümündeki efekt de çalışmaz (bölüm 2.6a). | Hafif (görününce), yok. |
| **Ayraç çizgisi** | Önceki bölümle arasına ince çizgi. | Yok, üstte ince çizgi. |
| **Anchor (bağlantı kimliği)** | Sayfa içi bağlantı için ad. Örnek: `avantajlar` yazarsanız adres `.../sayfa#avantajlar` olur. | Yalnız küçük harf, rakam ve tire. En fazla 40 karakter. Aynı sayfada iki blokta aynı ad olamaz. `main`, `ozellikler`, `genel-bakis`, `teknik-ozellikler`, `surumler`, `indirmeler`, `dokumantasyon` ayrılmıştır. |
| **Bloğu gizle** | Bloğu sitede gizler. | Açık/kapalı. |

Önemli notlar:

- Animasyonu tüm site için kapatmak da mümkündür. Bu ayar **Site ayarları** içindedir (bölüm 5).
- Bağlantı adı (anchor) yalnız sayfa içi bağlantılarda işe yarar. Boş bırakabilirsiniz.

### 2.6a "Hareket" (animasyon efektleri)

**Görünüm**'ün hemen altında **Hareket** bölümü vardır. Sayfanın "dümdüz" görünmemesi için her bloğa hazır bir efekt seçebilirsiniz. Serbest animasyon yoktur: hız ve mobil uyum için yalnız denenmiş hazır efektler sunulur.

**Efekt kartları.** Her kartın üstünde küçük bir önizleme kutusu oynar. **Tekrar oynat** düğmesi önizlemeleri yeniden başlatır. Kartlar:

| Efekt | Ne yapar |
|---|---|
| **Otomatik** (varsayılan) | Bugünkü hafif belirme. Hiçbir şey değiştirmezseniz site eskisi gibi görünür. |
| **Yok** | Blok hareketsiz görünür. |
| **Belirme** | Yerinde yavaşça görünür. |
| **Yukarı / Aşağı kayma** | Aşağıdan yukarı veya yukarıdan aşağı kayarak gelir. |
| **Sola / Sağa kayma** | Sağdan sola veya soldan sağa kayarak gelir. |
| **Yakınlaşma** | Hafifçe büyüyerek belirir. |
| **Paralaks** | Kaydırdıkça içerik zeminden hafifçe ayrışır. Varsayılan olarak yalnız tablet ve masaüstünde çalışır. |
| **Sırayla** | Kartlı/listeli bloklarda kartlar tek tek belirir. Diğer bloklarda bloğun parçaları sırayla gelir. |

**Gelişmiş** (kartların altında, kapalı gelir):

| Ayar | Seçenekler |
|---|---|
| **Tetikleyici** | Kaydırınca (görünür olunca bir kez, varsayılan) · Kaydırma ilerlemesine bağlı · Sayfa açılışında · Fareyle üzerine gelince |
| **Süre** | Hızlı (240 ms) · Orta (560 ms, varsayılan) · Yavaş (800 ms) |
| **Gecikme** | Yok · 100 · 200 · 300 ms |
| **Hız eğrisi** | Yumuşak (varsayılan) · Dengeli · Vurgulu |
| **Sırayla aralık** | Yok · Sık (60 ms, varsayılan) · Geniş (100 ms). Toplam en çok 300 ms. |
| **Paralaks mobilde de çalışsın** | Yalnız Paralaks seçiliyken görünür. |

Kurallar ve ipuçları:

- **Hız kuralı (otomatik):** Sayfanın ilk görünür içeriği ve her Giriş (Hero) bloğu, açılışta görünmez başlayan (belirme/yakınlaşma/sırayla) bir efekt alamaz. Seçerseniz site bunu kendiliğinden kısa bir kaymaya çevirir; içerik hep görünür kalır. Gizli, boş veya sonuç getirmeyebilen başlangıç blokları korumayı tüketmez; içerik kesinleşene kadar sonraki bloklar da korunabilir. Hero bloğunda yalnız kayma ve paralaks kartları gösterilir.
- **Fareyle üzerine gelince** içeriği gizlemez; fare ile üzerine gelindiğinde veya içindeki bağlantı/düğme klavye odağı aldığında hafifçe hareket eder. Klavye odağı dokunmatik cihaza bağlı klavyede de çalışır.
- **Kaydırma ilerlemesine bağlı** ve **Paralaks** yalnız destekleyen tarayıcılarda çalışır; diğerlerinde blok hareketsiz ve tam görünür kalır.
- Ziyaretçi cihazında "hareketi azalt" açıksa veya **Site ayarları → Animasyon: Kapalı** ise hiçbir efekt oynamaz.
- Ölçülü kullanın: bir sayfada 2-3 farklı efekt yeterlidir. Ardışık bloklarda aynı efekti tekrarlamak daha sakin görünür.
- Değişikliği **Live Preview**'de veya taslak önizlemede görebilirsiniz; efekt sayfa yenilendiğinde yeniden oynar.

### 2.7 Taslak ve yayın

SoftMarket'te iki durum vardır:

- **Taslak:** Değişiklik kaydedilir ama siteye çıkmaz. Ziyaretçiler görmez.
- **Yayında:** Ziyaretçiler görür.

Kurallar:

1. **Sayfalar** ve **Ürünler** koleksiyonlarında "Taslağı kaydet" düğmesi yoktur: değişiklikler zaten otomatik taslak olarak kaydedilir (bölüm 2.8) ve canlı siteye etkisi yoktur. Çözümler gibi otomatik kayıtsız taslaklı koleksiyonlarda ayrıca **Taslağı kaydet** düğmesi bulunur.
2. Sağ üstteki **Değişiklikleri yayınla** düğmesi değişikliği siteye çıkarır. Yanındaki ok **Türkçe dilinde yayınlayın** gibi yalnız geçerli dili yayınlama seçeneğini açar.
3. Yayına çıkmış bir sayfada yapılan taslak değişiklik, üst çubukta **Durum: Değişiklik yapıldı** olarak görünür. Taslağı atıp yayındaki hale dönmek için **Yayınlanana geri döndür** bağlantısını kullanın.
4. Sayfayı siteden tamamen kaldırmak için sağ üstteki **⋮** menüsünden **Yayından Kaldır** seçin.
5. Yayınlanmamış bir sayfa, yayında olan sürümün yerine geçmez. Siteye yalnız yayınlanmış hali gider.
6. Yayınladığınızda site önbelleği yenilenir. Değişiklik genellikle hemen görünür (bölüm 9'a bakın).

### 2.8 Otomatik kayıt

- Sayfa veya ürün düzenlenirken değişiklikler yaklaşık **2 saniye** sonra otomatik kaydedilir.
- Bu kayıt **taslak** olarak yapılır. Yayına çıkmaz.
- Otomatik kayıt, Live Preview'un güncel kalması için vardır.

### 2.9 Live Preview (canlı önizleme)

Live Preview, değişikliğinizi sitenin gerçek görünümünde gösterir. Sayfa düzenleme ekranında, sağ üstte **Değişiklikleri yayınla** düğmesinin solundaki **göz simgesine** (Önizleme) tıklayın. Ekran ikiye bölünür: solda form, sağda canlı önizleme. Göz simgesine yeniden tıklayınca önizleme kapanır. Yukarıdaki **Düzenle / Sürümler / API** sekmeleri önizleme açmaz; **Önizleme** adlı ayrı bir sekme yoktur.

1. Önizleme, sayfanın taslak halini gösterir. Yayında olmayan değişiklikler de görünür.
2. Önizlemenin üstündeki çubukta **Responsive** açılır listesinden ekran boyutunu seçin:
   - **Mobil / Mobile** (telefon)
   - **Tablet**
   - **Masaüstü / Desktop**

   Yanındaki genişlik × yükseklik kutularından özel boyut girebilir, yakınlaştırma oranını (%50-%200) değiştirebilir ve en sağdaki simgeyle önizlemeyi yeni sekmede açabilirsiniz.
3. Yazdıkça önizleme yaklaşık 2 saniye içinde (otomatik kayıtla) yenilenir.
4. Sitede taslak modundayken görünen şeritteki **Önizlemeden çık** düğmesi taslak modunu kapatır. Live Preview panelini kapatmak için göz simgesini kullanın.

Önizleme yalnız giriş yapmış editör ve yönetici için açılır. Ziyaretçiler taslakları göremez.
Live Preview; sayfalar, ürünler, ürün aileleri, çözümler, referanslar ve haberlerde vardır. **Şablon** sayfalarında public önizleme yoktur. İlişkili içerik listeleri önizlemede de yalnız yayınlı kayıtları gösterir. Yaklaşık 2 saniyelik otomatik kayıt **Sayfalar** ve **Ürünler** için açıktır; diğer koleksiyonlarda kaydetmeniz gerekir.

### 2.10 Görsel düzenle (sayfalar ve ürünler)

**Sayfalar** ve **Ürünler** kayıtları açılınca doğrudan **görsel düzenleyici** gelir: sağda sitenin gerçek görünümü (büyük tuval), solda dar form paneli. Tuval yayındaki sayfayla aynıdır; yalnız düzenleme çerçeveleri eklenir. Görsel düzenleyici yalnız yönetici ve editörlere görünür; ziyaretçi ve müşteri hesapları açamaz.

**Üst çubuk** (Kaydet/Yayınla düğmelerinin solunda):

| Düğme | Ne yapar |
|---|---|
| **Klasik forma geç / Görsel düzenle** | Tek tıkla yalnız forma geçer ve geri döner. Klasik form o ziyarete özeldir; kaydı bir sonraki açışınızda yine görsel düzenleyici gelir. |
| **↶ / ↷** | Geri al / yinele (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z). Formdaki ve tuvaldeki değişiklikleri adım adım geri alır (en çok 50 adım). |
| **390 / 768 / 1440 / Sığdır** | Önizleme genişliği: telefon, tablet, masaüstü, panele sığdır. |
| **TR / EN** | İçerik dili. Geçmeden önce bekleyen değişiklik kaydedilir. |
| Durum yazısı | Kaydediliyor… / Taslak kaydedildi / Kaydedilmemiş değişiklik. |
| **İpuçları** | 4 adımlık kısa turu yeniden açar (tur ilk açılışta bir kez kendiliğinden görünür). |

**Bloklarla çalışma (tuvalde):**

1. Bir bloğa tıklayın: mavi çerçeveyle **seçilir**, formda o bloğun satırı açılır ve **Görünüm** ile **Hareket** (Gelişmiş dahil) grupları görünür. Medya, zengin metin, bağlantı adresi ve efekt ayarlarını oradan yaparsınız.
2. Seçili bloğun araç çubuğu: **↑ / ↓** taşı, **⠿** tutamaçtan sürükleyip başka bloğun üstüne/altına bırak, **Metni düzenle**, **Çoğalt**, **Gizle / Göster**, **Sil** (ikinci tıkta onaylanır), **+ Blok ekle** (seçili bloğun altına; görselli blok listesi, arama kutusu).
3. **Metni yerinde düzenleme:** seçili bloktaki bir metne (başlık, üst etiket, giriş metni, buton etiketi, kart başlığı/açıklaması, tablo satırı, SSS sorusu…) tekrar tıklayın ve yazın. **Enter** bitirir, **Esc** vazgeçer. Yapıştırılan içerik düz metne çevrilir. Çok satırlı veya 1000 karakterden uzun metinler, zengin metin, görseller ve bağlantı adresleri formdan düzenlenir.
4. **Gizli bloklar** tuvalde soluk ve "Gizli: ziyaretçiler görmez" rozetiyle görünür; seçip **Göster** ile geri açarsınız. Yayındaki sayfada asla görünmezler.
5. **Klavye:** tuvale tıkladıktan sonra **↑ / ↓** önceki/sonraki bloğu seçer, **Alt+↑ / Alt+↓** seçili bloğu taşır, **Enter** ilk metni düzenler, **Delete** iki basışta siler, **Esc** seçimi bırakır.

**Ürün sayfası kuralları:** "Ürün: Giriş" hep ilk bloktur (taşınamaz, silinemez, gizlenemez). "Ürün: Sürümler ve Teklif İste" zorunludur: taşınabilir ama silinemez, gizlenemez. Ürün bölümleri çoğaltılamaz. Eski düzendeki (henüz bölüm bloğu olmayan) bir üründe ilk taşıma/ekleme/gizleme işleminde bölümler **otomatik** düzenlenebilir bloklara dönüştürülür; eski düzende gizlenen tekrar bloklar (ör. ikinci Giriş) gizli olarak eklenir, sayfanın görünümü değişmez. Ürün adı, slogan, özet ve özellik kartları da yerinde düzenlenebilir (ürün kaydına yazılır).

**Dil (TR/EN):** EN'de bir alan boşsa tuval TR metnini yedek olarak gösterir; tıklayınca "Bu dilde metin yok" uyarısı çıkar, yazdığınız yalnız EN'e kaydedilir. Hiç yazmazsanız EN boş kalır (TR metni kopyalanmaz).

**Kayıt ve çakışma:** Değişiklikler ~2 sn içinde taslak olarak kaydedilir. Sekmeyi kapatır veya başka sekmeye geçerseniz bekleyen değişiklik hemen gönderilir. Kayıt başka yerden (MCP, başka sekme, içerik importu) değişmişse sizin sonraki kaydınız sunucuda **reddedilir** (diğer değişiklik asla ezilmez) ve üstte uyarı çıkar; yazdığınız ekranda kalır. **Birleştir ve kaydet** güncel sürümü alır; bağımsız alan ve blok değişikliklerini satır kimlikleriyle birleştirir. Aynı metin, zengin metin, satır silme veya sıralama iki tarafta çakışıyorsa kaydetmez ve alanları listeler; değişikliklerinizi kopyalayıp yeniden yükleyin. Başarılı birleştirme önceki geri alma geçmişini temizler. **Değişikliklerimi kopyala** değiştirdiğiniz alanları metin olarak verir. **Yeniden yükle** güncel hali getirir; kaydedilmemiş değişiklikler kaybolur (onay sorulur). Aynı kaydı aynı anda iki kullanıcı açarsa Payload belge kilidi ikinciye uyarı gösterir. Ziyaretçiler değişikliği **Değişiklikleri yayınla** sonrasında görür.

**Sınırlar:** Önizlemeyi ayrı pencerede (açılır pencere simgesi) açarsanız düzenleme araçları çalışmaz; tuvali panelde kullanın. Zengin metin içi geri alma, metin kutusunun kendi geri almasıdır. Çözümler, referanslar ve ürün aileleri için görsel düzenleyici sonraki sürümdedir (Live Preview ile önizleme vardır).

---

## 3. Blok kataloğu

Her blokta **Görünüm** bölümü vardır (bölüm 2.6). Aşağıda yalnız blokların kendi ayarları yer alır.

### 3.1 Giriş (Hero)

Sayfanın üst bölümüdür. Başlık, açıklama ve en fazla **2 düğme** içerir.

- **Yerleşim (varyant):**
  - **Sinematik** (varsayılan): Izgara ve parıltı efekti. Medya sağda.
  - **İkiye bölünmüş**: Metin solda, medya sağda.
  - **Ortalanmış**: Metin ortada, medya altta.
  - **Sade**: Dekor yok. Yalnız metin.
  - **Arka plan görseli / videosu**: Tam genişlik arka plan.
- **Sağ panel** (yerleşim Sinematik veya İkiye bölünmüş ise): Görsel veya ürün aileleri listesi (otomatik) seçilebilir.
- **Alanlar:** Üst etiket, başlık (zorunlu), açıklama, görsel, düğmeler.

#### Arka plan video kuralları

- Yerleşim **Arka plan görseli / videosu** seçildiğinde video yükleyebilirsiniz.
- Video için önerilen üst süre **15 saniyedir**; sistem süreyi otomatik denetlemez.
- Video **sessiz** ve **döngülü** olmalı. Format: **MP4** veya **WebM**.
- Videoyu yüklerken **herkese açık** yükleyin. Yani **Korumalı** kutusunu işaretlemeyin.
- **Poster görseli zorunludur.** Video yüklüyse poster de yüklenmelidir.
- Video yalnız en az **768 piksel** genişlikte, ziyaretçinin "hareketi azalt" ve veri tasarrufu ayarları kapalıyken yüklenir. Site animasyonu kapalıysa da poster gösterilir.
- Mobil cihazlarda ve bu ayar açıkken poster görseli görünür. Bu nedenle poster de iyi bir görsel olmalıdır.

### 3.2 Özellik ızgarası (Özellik ızgarası)

Kısa özellik kartlarını ızgarada gösterir.

- **Sütun:** 2, 3 veya 4.
- **Stil:** Kartlar (çerçeveli) veya sade (çerçevesiz).
- Her özellik için: ikon, başlık (zorunlu), açıklama.
- **Görsel seçerseniz** ikon yerine görsel gösterilir.

### 3.3 Medya + metin

Bir görsel ile bir metni yan yana koyar.

- **Görsel konumu:** Solda veya sağda.
- Başlık, zengin metin ve en fazla **2 düğme**.

### 3.4 Teknik tablo

Ürün özelliklerini tablo halinde gösterir.

- Gruplar halinde çalışır. Her grubun bir başlığı ve satırları vardır.
- Her satır: **özellik** ve **değer**.

### 3.5 Rakamlar

Büyük sayıları gösterir. Örnek: "500+", "%99,9".

- En fazla **6** rakam.
- Her rakam: değer, etiket, isteğe bağlı açıklama.

### 3.6 Logo şeridi

Müşteri ve iş ortağı logolarını gösterir.

- **Kaynak** seçin:
  - Elle eklenen logolar
  - Referans müşteriler (vakalardan otomatik)
  - İş ortakları
  - Tüm iş ortakları (otomatik)
  - Tüm referans müşteriler (otomatik)
  - İş ortakları ve referanslar (otomatik)
- **En çok kaç logo:** 1 ile 24 arası.
- Elle eklerken her logonun **adı** zorunludur. Bağlantı isteğe bağlıdır.

### 3.7 Çağrı bandı (CTA)

Ziyaretçiyi bir işleme yönlendirir. Örnek: "Teklif isteyin".

- **Stil:** Bant (koyu, parıltılı), kart (ortalanmış), yan yana (metin solda, düğmeler sağda).
- Başlık zorunludur. Metin isteğe bağlıdır.
- **1 ile 2** düğme.

### 3.8 Sık sorulan sorular (SSS)

Soru-cevap listesi. Açılır kutularla çalışır.

- **Kaynak:**
  - **SSS koleksiyonundan seç:** Önceden oluşturduğunuz SSS kayıtlarından seçersiniz.
  - **Bu blokta yaz:** Soruları doğrudan bu bloğa yazarsınız.
- Her soru ve cevap zorunludur.

### 3.9 Zengin metin

Serbest metin bloğudur. Başlık, paragraf, liste ve bağlantı ekleyebilirsiniz.

- **Metin genişliği:** Dar, normal veya geniş.
- Metin **her dilde ayrı** yazılır (bölüm 8).

### 3.10 Video

YouTube veya Vimeo videosunu gösterir.

- Yalnız **https** ile başlayan YouTube veya Vimeo adresleri kabul edilir.
- Video ilk açılışta hafif bir kapak görseli olarak görünür. Ziyaretçi tıklayınca video yüklenir. Bu sayede sayfa hızlı açılır.

### 3.11 Görsel / galeri

Tek görsel veya görsel ızgarası.

- **1 görsel:** tam genişlikte.
- **2 ile 4 görsel:** ızgarada yan yana.
- **En-boy oranı:** Özgün oran (kırpmaz), 16:9, 4:3, kare (1:1) veya geniş (21:9). Sabit bir oran seçerseniz görsel kırpılarak doldurulur.
- Her görsel için alt yazı isteğe bağlıdır.

### 3.12 Müşteri görüşü (Testimonial)

Bir müşterinin alıntısını gösterir.

- **Alıntı** ve **kişi** zorunludur.
- Unvan, firma, fotoğraf ve firma logosu isteğe bağlıdır.
- Fotoğraf ve logo için herkese açık bir görsel kullanın.

### 3.13 Sekmeler

Birkaç bölümü sekmelerle gösterir. Ziyaretçi sekmeye tıklayarak geçer.

- **2 ile 6** sekme.
- Her sekmenin adı zorunludur.
- Her sekmede zengin metin ve isteğe bağlı görsel olabilir.

### 3.14 Boşluk

Bloklar arasına boş alan ekler.

- **Yükseklik:** Küçük, orta, büyük, çok büyük.
- Arka plan rengi için boşluk bloğunu değil, **Görünüm > Tema** ayarını kullanın.

### 3.15 Ayraç

Bloklar arasına çizgi koyar.

- **İnce çizgi**: Düz çizgi.
- **Vurgu rengi**: Ortada kısa vurgu çizgisi.

### 3.16 Ürün aileleri

Ürün ailelerini kartlar halinde gösterir.

- **Kaynak:** Tüm aileler (otomatik) veya elle seçilen aileler.
- **Ürün sayısını göster:** Her ailede kaç ürün olduğunu yazar.

### 3.17 Ürün vitrini

Seçilen ürünleri öne çıkarır.

- **Kaynak:**
  - Öne çıkan ürünler
  - Tüm ürünler
  - Elle seçilen ürünler
  - Aileye göre (bir ürün ailesi seçersiniz)
  - Sektöre göre (bir sektör seçersiniz)

### 3.18 Çözümler

Çözüm kartlarını gösterir.

- **Kaynak:** Tüm çözümler, elle seçilen çözümler veya sektöre göre.

### 3.19 Öne çıkan vaka

Bir referans çalışmasını (vakayı) büyük kart olarak gösterir.

- **Kaynak:**
  - Öne çıkan vaka (yoksa en yeni)
  - En yeni vaka
  - Elle seçilen vaka
  - Sektöre göre
- **Sonuç metriklerini göster:** Vakadaki rakamları gösterir.
- **Vaka bağlantısı:** Bağlantı metni ve adresi isteğe bağlıdır. Boş bırakırsanız vakanın kendi sayfasına gider.

### 3.20 Haber listesi

Haberleri, yazıları veya etkinlikleri gösterir.

- **Kaynak:**
  - Son haberler
  - Kategoriye göre (haber, ürün güncellemesi, etkinlik, blog)
  - Elle seçilen haberler
- Ayrıca **En çok kaç kayıt**, **Sıralama** ve **Düzen** seçilebilir.

### 3.21 Liste (listing) bloğu

Bu blok **Sayfalar** koleksiyonunda seçilebilir; yalnız **sistem sayfalarında** (bölüm 4) işlev görür. Ana sayfa veya landing sayfasında liste üretmez.

- Sayfanın kendi listesinin yerini belirler: ürünler, çözümler, haberler, referanslar, kariyer, iş ortakları, destek, iletişim.
- Liste bloğunun içerik alanı yoktur. Yalnız yerini ve **Görünüm** ayarlarını değiştirirsiniz.
- Blok yoksa liste, üst bölümün (hero) hemen altında görünür.
- Listeyi gizlemek için bloğu **gizle** yapın (bölüm 2.5).

---

## 4. Sistem sayfaları ve yeni landing sayfası

### 4.1 Sistem sayfaları

Sistem sayfaları sitenin özel sayfalarıdır. Her birinden yalnız **bir** tane vardır. Bunlar:

| Sayfa | Adres (TR) |
|---|---|
| Ürünler | /tr/urunler |
| Çözümler | /tr/cozumler |
| Haberler | /tr/haberler |
| Referanslar | /tr/referanslar |
| Kariyer | /tr/kariyer |
| İş ortakları | /tr/is-ortaklari |
| Destek | /tr/destek |
| İletişim | /tr/iletisim |
| Hakkımızda | /tr/sirket/hakkimizda |

Her sistem sayfası iki bölümden oluşur:

1. **Üst bölüm (Hero):** Üst etiket, başlık ve açıklama. Boş alan bırakırsanız sitenin varsayılan metni kullanılır.
2. **Bloklar:** Üst bölümün altına eklediğiniz bloklar. Liste bloğu bu blokların arasında yer alabilir.

Kural: Üst bölüm alanlarından birini boş bırakırsanız o alanda çeviri dosyasındaki varsayılan metin görünür. Metni değiştirmek için alana kendi metninizi yazın.

### 4.2 Yeni landing sayfası açma

Landing sayfası, kampanya veya ürün tanıtımı için yeni bir sayfadır.

1. **Sayfalar** bölümünde **Yeni oluştur** düğmesine basın.
2. Sayfa türünü **Landing** seçin.
3. Başlık ve slug (adres) girin.
4. Türkçe ve İngilizce alanlarını doldurun (bölüm 8).
5. Blokları ekleyin ve sıralayın.
6. **Değişiklikleri yayınla** düğmesine basın.

Adres:

- Türkçe: `/tr/<slug>`
- İngilizce: `/en/<en-slug>`

#### Ayrılmış adresler

Şu adresler sistem tarafından kullanıldığı için landing sayfasında kullanılamaz:

- `urunler`, `products`, `cozumler`, `haberler`, `hesap`, `admin` ve benzeri adlar.
- Bu adlar kaydedilirken hata verir. Farklı bir slug seçin.

Ayrılmış adların tam listesi teknik ekipte bulunur.

#### Şablondan çoğaltma

Hazır bir sayfa yapısını tekrar kullanmak için:

1. Sayfa türü **Şablon** olan bir kaydı açın. Şablonlar sitede **asla görünmez**.
2. Sağ üstteki **⋮** menüsünden **Çoğalt** seçin. "Sayfa başarıyla kopyalandı." iletisi görünür.
3. Yeni kopya açılır. Kopyanın sistem sayfası bağlantısı boş gelir.
4. Sayfa türünü **Şablon** yerine **Standart** veya **Landing sayfası** yapın; kopya aksi halde yayınlansa da sitede görünmez.
5. Başlığı ve her iki dilde slug değerini değiştirin, sonra yayınlayın.

### 4.3 Sayfa bağlantılarını ayarlama

Başka bir sayfaya bağlantı verirken iki yol vardır:

- **Sayfaya bağlantı:** Bağlantı türü **Site içi** seçilir ve listeden sayfa seçilir. Dil değiştiğinde sayfanın adresi o dile göre otomatik değişir.
- **Sitenin hazır yolu:** Bağlantı türü **Site sayfası (yol)** seçilir. Hazır yollardan birini seçersiniz. Örnek: Ürünler.

---

## 5. Menü, footer ve site ayarları

Üst menü ve alt bilgiyi yönetici veya editör, **Site ayarları**nı yalnız yönetici değiştirebilir. Bu üç bölümde taslak/yayın ayrımı yoktur: **kaydetmek değişikliği hemen siteye uygular**.

### 5.1 Üst menü (Header)

- **Menü öğeleri:** Her öğe için bağlantı, metin ve isteğe bağlı açılır menü.
- **Açılır menü (mega menü):**
  - **Ürünler** veya **Çözümler** otomatik listelenir.
  - **Özel** seçerseniz kendi kolonlarınızı ve öne çıkan kartınızı yazarsınız.
- **Düğmeler:** En fazla **2** düğme.
- **Yardımcı alan:** Arama simgesi, dil değiştirici ve müşteri hesabı bağlantısı açılıp kapatılabilir.
- **Duyuru bandı:** Sayfanın en üstünde ince bir bant. **Göster** açık ve metin doluysa görünür. **Ziyaretçi kapatabilir** seçeneği açıksa ziyaretçi bandı kapatabilir.

### 5.2 Alt bilgi (Footer)

- **Kolonlar:** Başlık ve bağlantı listesi.
- **Yasal bağlantılar:** Gizlilik, kullanım koşulları vb.
- **Marka açıklaması:** Kısa metin.
- **İletişim bilgilerini göster:** Site ayarlarındaki iletişim bilgilerini alt bilgide gösterir.
- **Sosyal bağlantıları göster:** Site ayarlarındaki sosyal medya bağlantılarını gösterir.
- **Bülten alanları:** Panelde bulunur; mevcut frontend footer'ında bülten formu render edilmez.
- **Telif hakkı metni:** `{year}` yazarsanız yıl otomatik gelir. `{siteName}` yazarsanız site adı gelir.

### 5.3 Site ayarları

#### Kimlik

- **Site adı** (zorunlu): Tarayıcı sekmesinde ve arama sonuçlarında görünür.
- **Slogan:** Kısa tanıtım cümlesi.
- **Logo:** Açık zeminde kullanılan logo.
- **Koyu logo:** Koyu zeminde kullanılan logo. Boş bırakırsanız açık logo kullanılır.
- **Favicon:** Tarayıcı sekmesindeki küçük simge.
- **Varsayılan paylaşım görseli:** Sosyal medyada paylaşıldığında çıkan görsel.

Logo boş bırakılırsa site kendi varsayılan logosunu gösterir.

#### Marka ve hareket

- **Vurgu rengi (hex):** Düğmeler ve vurgular için renk. Örnek: `#2f5fe0`.
  - Boş bırakırsanız sitenin varsayılan renkleri kullanılır.
  - Renk, **kontrast** kuralını geçmelidir (aşağıda).
- **Animasyon:**
  - **Hafif:** Blokların görününce hafifçe belirmesi.
  - **Kapalı:** Bütün animasyonlar durur. Sitenin tamamı için geçerlidir.

#### Renk reddedilirse

Vurgu rengi yalnız okunabilirlik kuralını geçerse kaydedilir. Girilen renk, en az **bir temada** hem zeminler üzerindeki metin/bağlantı hem de düğme üzerindeki yazı için **4,5:1** kontrastı sağlamalıdır (WCAG AA). Diğer temanın ve hover durumunun uygun tonları otomatik türetilir. İki temada da kuralı geçemeyen renk reddedilir. Renk kabul edilmezse mesaj şöyle görünür:

> Kontrast yetersiz (WCAG AA en az 4,5:1): koyu tema X:1, açık tema Y:1. Daha koyu veya daha açık bir ton seçin.

Ne yapmalı:

1. Mesajdaki oranlara bakın. Hangi tema düşük kalıyor görün.
2. Rengi biraz **koyultun** (açık zeminde) veya **açın** (koyu zeminde).
3. Yeni değeri girip kaydedin.
4. Kabul edilmezse aynı kuralla başka bir ton deneyin. Yardım gerekirse teknik ekibe haber verin.

Renk hex biçiminde olmalıdır. `#` ile başlayan 3 veya 6 haneli kod girin; kısa kod kayıtta 6 haneye çevrilir. Yanlış biçimde şu mesaj çıkar: "#2f5fe0 gibi bir hex renk girin."

#### İletişim

- **E-posta, satış e-postası, destek e-postası, telefon, adres, harita adresi, çalışma saatleri.**
- Boş bıraktığınız alan sitede **gizlenir**. Yani adres yoksa adres satırı hiç görünmez.

#### Sosyal bağlantılar

- Platform seçin (örneğin LinkedIn, X, YouTube) ve tam bağlantı adresini girin.
- Bağlantı adresi zorunludur.

#### Şirket bilgileri

- Unvan, vergi dairesi, vergi numarası, MERSİS numarası ve KEP adresi saklanır; mevcut frontend bunları alt bilgiye veya hukuki metinlere otomatik eklemez. Hukuki sayfa metinlerini ayrıca düzenleyin.

#### Ana sayfa seçimi

- **Ana sayfa** alanında hangi sayfanın ana sayfa olacağını seçersiniz.
- Boş bırakırsanız sistem `home` slug'lı sayfayı arar.
- Hiçbiri yoksa sitenin hazır ana sayfası gösterilir.

---

## 6. Medya (görseller, videolar, dosyalar)

### 6.1 Yükleme

1. Sol menüden **Medya** bölümüne girin.
2. **Yeni oluştur** düğmesine basın, ardından **Dosya seç** ile dosyayı seçin (ya da dosyayı sürükleyip bırakın; **URL yapıştır** ile adresten de alınabilir). Sayfa/ürün formlarındaki görsel alanlarında aynı işlem **Yeni oluştur** ve **Varolanlardan seç** düğmeleriyle yapılır.
   Yükleme sonrası **Kaydet** düğmesine basın.
3. Görsel yüklendikten sonra alanları doldurun.

### 6.2 Alt metin (zorunlu)

- Her görsel için **alt metin** zorunludur. Türkçe ve İngilizce ayrı yazılır.
- Alt metin, görme engelli kullanıcılar ve arama motorları için görselin ne olduğunu anlatır.
- Örnek: "Kurumsal yazılım panelinin ekran görüntüsü".
- Süs amaçlı görselde de kısa bir açıklama yazın.

### 6.3 Odak noktası

- Görsel bir kutuya kırpılıyorsa önemli kısmın kalması için **odak noktası** seçebilirsiniz.
- Görselin üzerinde bir noktaya tıklayın. Kırpılan alan bu noktayı merkez alır.

### 6.4 Korumalı mı, herkese açık mı?

- **Herkese açık (Korumalı kutusu kapalı):** Ziyaretçi herkes görebilir. Sitedeki tanıtım görselleri için bu seçilir.
- **Korumalı dosya** varsayılan olarak açıktır. Tanıtım görsellerini **ilk yükleme sırasında** bu kutuyu kapatarak oluşturun. Kaydedilmiş korumalı dosyada kutuyu kapatmak korumayı kaldırmaz.
- **Korumalı:** Personel görebilir. Müşterinin yalnız giriş yapması yetmez: ilgili ürüne geçerli lisansı ve dosyayı yetkilendiren bir indirme kaydı veya lisanslı medya eşlemesi gerekir. Abonelik başlamamışsa, süresi dolmuşsa veya lisans askıda/iptalse erişemez.
- **İndirmeler** kaydına bağlanacak medya korumalı olmalıdır. İndirme kaydının **Erişim** alanı **Herkese açık** seçilirse dosya anonim ziyaretçiye de açılır; **Lisanslı müşteriler** seçilirse geçerli ürün lisansı gerekir. Aynı dosyaya bağlı herkese açık bir indirme, o dosyayı herkese açar.
- Yanlışlıkla korumalı kaydettiğiniz tanıtım görseli için, yalnız yayımlanmasına izin verilen dosyayı yeni bir medya kaydı olarak korumasız yükleyin ve sayfadaki seçimi değiştirin. Gizli veya lisanslı dosyaları bu yolla açmayın.

### 6.5 Otomatik boyutlar ve format

- Desteklenen raster görseller için kaynak boyutu yeterliyse dört türev üretilir: **400, 768, 1280 ve 1920 piksel** genişlik. SVG/GIF gibi dosyalarda aynı türevler beklenmemelidir.
- Türevler **WebP** formatındadır; özgün dosya ayrıca korunur.
- Büyütme yapılmaz. Görsel zaten küçükse küçük boyut üretilmez.
- Boyut dosyaları da aynı koruma kuralına uyar. Korumalı görselin küçük hali de herkese açık olmaz.
- Görseli değiştirirseniz boyutlar otomatik güncellenir.
- Önerilen genişlik: en az **2400 piksel**. Daha büyük görseller daha net çıkar; sistem gerekli boyutu kendisi üretir.

### 6.6 Konum bilgisi silinir

- Yeni veya değiştirilen **JPEG, PNG, WebP, TIFF, HEIC/HEIF** yüklemelerinde **GPS, EXIF, XMP ve IPTC** metadata temizlenir. HEIC/HEIF işleme sunucudaki codec desteğine bağlıdır; temizleme başarısızsa yükleme reddedilir.
- Fotoğraf doğru yönde açılır. Yani telefonla çekilen dik fotoğraf yan çıkmaz.
- Renk profili korunabilir. Mevcut dosyalar ile **SVG, GIF, video ve PDF** bu temizleme kapsamında değildir; bunlarda gizli bilgiler otomatik silinmez.

### 6.7 Video ve PDF

- Sitedeki arka plan videosu için kurallar bölüm 3.1'dedir.
- Ürün dosyaları ve PDF'ler **Medya** bölümüne korumalı yüklenir; ardından **İndirmeler** kaydında bu medya seçilip ürün ve erişim düzeyi belirlenir.

---

## 7. Ürünler, sürümler ve teklif

### 7.1 Fiyat yok

- SoftMarket sitesinde **fiyat yazılmaz**. Online ödeme yoktur.
- Her sürümde **Teklif İste** düğmesi bulunur.
- Ziyaretçi teklif isteği gönderir. Ekip teklifi hazırlar.

### 7.2 Ürün ve sürüm yapısı

- **Ürün ailesi:** En üst grup. Örnek: "Muhasebe".
- **Ürün:** Ailenin altındaki ürün. Örnek: "Muhasebe Pro".
- **Sürüm:** Ürünün paketi ya da lisans türü. Her sürümün bir **SKU** kodu vardır.

### 7.2a Ürün sayfası düzeni (ürün blokları)

Ürün sayfasındaki bölümler **"Ürün:"** ile başlayan bloklardır: Giriş (başlık + Teklif İste), Sekme çubuğu, Genel bakış, Özellikler, Teknik özellikler, Sürümler ve Teklif İste, İndirmeler, Dokümantasyon. Blok seçicide **Ürün sayfası bölümleri** grubundadır.

- Bu bloklarda metin yazılmaz. Başlık, özet, özellikler, teknik tablo, sürümler, indirmeler ve dokümanlar ürün kaydından (ve bağlı sürüm/indirme/doküman kayıtlarından) okunur. Bölüm içeriğini değiştirmek için ürünün ilgili sekmesini düzenleyin.
- **Sayfa blokları boşsa** (ya da yalnız SSS, CTA gibi ek bloklar varsa) sayfa varsayılan sırayla çizilir: Giriş, Sekme çubuğu, Genel bakış, Özellikler, Teknik özellikler, Sürümler, İndirmeler, Dokümantasyon, ardından ek bloklar.
- **İlk "Ürün:" bloğunu eklediğinizde sıra sizindir:** bölümler listedeki sırayla çizilir; listede olmayan bölüm görünmez. Bu yüzden varsayılan düzenden geçerken kullanmak istediğiniz tüm bölümleri ekleyin.
- **"Ürün: Sürümler ve Teklif İste" zorunludur.** Yeri değiştirilebilir ama silinemez ve gizlenemez; bu bloğu kaldırıp kaydetmeye/yayınlamaya çalışırsanız kayıt hata vererek reddedilir (otomatik kayıt dahil). Her sürüm kartındaki **Teklif İste** düğmesi sürümün SKU'su ile teklif formunu açar.
- **"Ürün: Giriş"** sayfa başlığını (h1), gezinti yolunu ve üstteki Teklif İste düğmesini taşır; her zaman ilk bloktur ve gizlenemez. Eklemezseniz sayfa yine en üstte varsayılan girişi gösterir.
- İndirmeler, Dokümantasyon ve Sekme çubuğu serbesttir: taşıyabilir, gizleyebilir veya silebilirsiniz. Sekme çubuğu yalnız sayfada görünen bölümlere bağlantı verir.
- "Ürün: Teknik özellikler" bloğunda **Sistem gereksinimlerini göster** seçeneği vardır.
- Her ürün bloğunda **Görünüm** (tema, boşluk, hizalama, ayraç) ve **Hareket** (bölüm 2.6a) ayarları bulunur. Bölüm kimlikleri sabit olduğu için anchor alanı yoktur. Girişte yalnız kayma/paralaks efektleri seçilebilir (sayfa açılışını yavaşlatmamak için).
- Ürünlerde de değişiklikler yaklaşık **2 saniyede** otomatik taslak olarak kaydedilir ve Live Preview yenilenir; yayın için **Değişiklikleri yayınla**.

### 7.3 SKU nedir?

- SKU, sürümün **sabit kodudur**. Dil ne olursa olsun aynı kalır.
- Teklif ve lisans kayıtları SKU ile eşleşir.
- Panelde SKU değiştirmek aynı kaydı günceller; ancak import eski/yeni SKU'yu farklı kimlikler sayar ve eski teklif bağlantıları bozulabilir. Bu nedenle kullanılan SKU'yu değiştirmeyin.
- Her sürümün SKU'su tektir. İki sürüm aynı SKU'yu taşıyamaz.

### 7.4 Lisans atama (yalnız yönetici)

- Lisansları **yalnız yönetici** oluşturabilir, düzenleyebilir veya silebilir.
- Editör lisans işlemi yapamaz. Müşteriler de lisans oluşturamaz.
- Lisans anahtarı sistem tarafından otomatik üretilir. Elle yazmanız gerekmez.
- Ürün sürümden türetilir; koltuk sayısı boşsa sürümün koltuk sayısı varsayılan alınır. Yönetici farklı sayı girebilir.
- Abonelik bitişi boşsa başlangıç tarihi + süre (ay) hesaplanır; yönetici bitişi ayrıca belirleyebilir. Geçerli lisans için durum **Aktif**, başlangıç geçmiş ve bitiş (varsa) gelecekte olmalıdır. Süre dolunca durum etiketi otomatik değişmese de erişim kapanır.
- Lisans yönetimi panel veya yetkili yönetici API/MCP üzerinden yapılabilir. **MCP'de lisans silme kapalıdır.**

---

### Satış yasal sayfaları

Çevrimiçi satış (ödeme) açılacaksa üç yasal sayfa gerekir: **mesafeli satış sözleşmesi**, **ön bilgilendirme formu**, **iade ve cayma politikası**.

- Sayfalar "Sayfalar" koleksiyonunda, **Sayfa türü = Hukuki** olan kayıtlardır. Kenar çubuğundaki **Satış yasal sayfası türü** alanından hangisi olduğu seçilir (her tür yalnız bir sayfada olabilir; alan yalnız Hukuki sayfada görünür).
- Taslak metinler `content/legal/{tr,en}/` altındadır ve hukukçu onayı gerektirir. Üstteki "TASLAK" bandı ve `[KÖŞELİ]` alanlar silinene dek sayfa `noindex` kalır, sitemap'e girmez ve **ödeme açılamaz**.
- **Şirket bilgisi yer tutucuları otomatik dolar:** `[ŞİRKET UNVANI]`, `[ADRES]`, `[MERSİS]`, `[VERGİ DAİRESİ/NO]`, `[KEP]`, `[ETBİS NO]`, `[TELEFON]`, `[KVKK İLETİŞİM E-POSTASI]` metinden silinmez; Site ayarları > **Şirket ve iletişim** (unvan, MERSİS, vergi dairesi, vergi no, KEP, ETBİS no; adres, telefon, genel e-posta) doldurulunca sitede, sözleşme kopyasında ve kontrollerde gerçek değerle görünür. Değer boşsa yer tutucu kalır ve sayfa taslak sayılır. Diğer köşeli alanları (`[YÜRÜRLÜK TARİHİ]`, `[HUKUK İNCELEMESİ: …]` vb.) hukukçu ile birlikte metinden düzeltin.
- **Hukukçu onayı:** Sayfanın kenar çubuğundaki **Hukukçu onayı** (yalnız yönetici, dil başına) alanına onaylayanın adını ve onay tarihini girip kaydedin. Onay o anki başlık ve metne bağlanır: metin sonradan değişirse onay kendiliğinden geçersiz olur; yeniden onay için tarihi güncelleyin. Onaysız satış sayfasıyla ödeme açılmaz. Editör ve API/MCP onay giremez.
- Hazır olunca bandı ve hukukçu yer tutucularını temizleyip **TR ve EN** sayfayı yayınlayın ve onaylayın. Site ayarları > "Satış ve ödeme" hazırlık listesinde "yasal sayfalar" satırı 3/3 ve "hukukçu onaylı sürüm" 6/6, "Şirket bilgileri tam" satırı ✓ olmalıdır.
- Ödeme kapalıyken (yalnız teklif) bu üç sayfa ziyaretçiye 404 verir; menü/footer bağlantıları, sitemap'ten de çıkar. Taslak önizlemesi personele açıktır.
- Sayfalar `pnpm content:import --legal` ile yüklenir (dosya adından tür atanır); bu komut mevcut aynı slug kayıtlarının iki dildeki metinlerini de değiştirip yayınlar; hukukçu onaylı metinlerin üzerine taslak yazabilir. Önce DB/uploads kopyasında `--dry-run --legal` ile inceleyin, canlıda yalnız onaylı kaynaklarla çalıştırın.

### Entegrasyon ayarları (yalnız yönetici)

Yönetim > **Entegrasyon ayarları**: ödeme sağlayıcısı anahtarları ve e-posta (SMTP) hesabı. Editörler bu sayfayı görmez.

- **Üst kutu (salt okunur):** site adresi, ödeme kilidi (`PAYMENTS_ENABLED`), Stripe izni ve şifreleme anahtarı sunucuda belirlenir; burada yalnız görünür. Her sağlayıcı/SMTP için kaynak yazar: **sunucu ayarı** (ortam değişkeni tanımlı; panel değeri yok sayılır), **panel** veya **yok**.
- **Gizli değerler (anahtarlar, SMTP şifresi):** "Gir/Değiştir" ile yazıp **Anahtarı kaydet**'e basın. Değer şifrelenip saklanır ve **bir daha gösterilmez**; yalnız "Tanımlı · son 4 karakter · güncellenme zamanı" görünür (SMTP şifresinin son karakterleri gösterilmez). "Temizle" kaydı siler. Bu alanlar sayfanın "Kaydet" düğmesinden bağımsızdır.
- **Ortam:** iyzico ve Stripe için Test (sandbox) / Canlı seçilir; seçili ortamın anahtarları kullanılır, API adresi seçimden gelir. Canlıya geçerken "Canlı ortamı onaylıyorum" kutusu işaretlenmeden kayıt yapılmaz (gerçek kartlardan tahsilat yapılır).
- **Stripe** yalnız sunucuda izin varsa (`PAYMENTS_STRIPE_ENABLED=true`) kullanılır; test anahtarı `sk_test_`, canlı `sk_live_`, webhook sırrı `whsec_` ile başlamalıdır.
- **SMTP:** önce sunucu, port, TLS, kullanıcı adı, gönderen adresi/adı girip **sayfayı kaydedin**, sonra şifreyi girin. Sunucu veya kullanıcı değişirse kayıtlı şifre güvenlik gereği geçersiz olur ("Okunamıyor"); yeniden girin. **Test e-postası gönder (bana)** kayıtlı ayarlarla yalnız sizin adresinize ileti yollar (dakikada 1, saatte en çok 5).
- Sağlayıcıyı sitede açma/kapama ve KDV, Site ayarları > Talepler > **Satış ve ödeme** bölümündedir; hazırlık listesi anahtar kaynağını (panel/sunucu/yok), SMTP'yi, eksik şirket bilgilerini ve hukukçu onayını gösterir.
- "Şifreleme anahtarı: hayır" görünüyorsa gizli değer kaydedilemez; sunucu yöneticisine `SOFTMARKET_SECRETS_KEY` tanımlatın. Bu anahtar değişir veya kaybolursa kayıtlı değerler "Okunamıyor" olur ve yeniden girilmelidir.

## 8. Çeviri (TR ve EN)

### 8.1 Diller

- Site iki dildedir: **Türkçe** (varsayılan) ve **İngilizce**.
- İçerik dil seçicisi aynı kaydın o dildeki alanlarını açar. Panelin arayüz dili bundan ayrıdır; etiketleri Türkçe/İngilizce görmek için arayüz dilini değiştirin.

### 8.2 Hangi alanlar çevrilir?

- **Çevrilen alanlar** (her dilde ayrı yazılır): başlıklar, açıklamalar, düğme metinleri, slug (adres), alt metin, bloklardaki metinler.
- **Ortak alanlar** (her dilde aynıdır): bloğun türü, sıralama, görünüm ayarları, görseller, SKU, sayılar ve fiyatsız teklif bilgileri.

### 8.3 İki dili birlikte doldurma

1. Türkçe alanı doldurun.
2. Dili **İngilizce** seçin.
3. Aynı alanlara İngilizce karşılığını yazın.
4. Her iki dil de dolu olmalıdır. Boş bırakılan İngilizce alanda site Türkçe metni gösterebilir.

### 8.4 Bloklar iki dilde aynı sırada olmalı

- Blok yapısı ve sırası ortak olduğundan bir dilde blok ekleme, silme veya sıralama **iki dili de etkiler**. Yapısal işlemi bir kez yapın; diğer dilde yalnız çevrilen alanları tamamlayın.

### 8.5 Slug (adres) çevirisi

- Her sayfanın Türkçe ve İngilizce adresi ayrıdır.
- Başlığı yazdığınızda adres otomatik oluşur. Gerekirse düzeltebilirsiniz.
- Aynı dilde iki sayfa aynı adresi taşıyamaz.

---

## 9. Sık sorulan sorunlar

### Değişiklik görünmüyor

1. **Yayınladınız mı?** Taslak (otomatik kayıt dahil) siteye yansımaz. Sağ üstteki **Değişiklikleri yayınla** düğmesine basın.
2. **Doğru dili mi açtınız?** Türkçe sitede yaptığınız değişiklik İngilizce sayfada görünmez. Dil değiştirip aynı değişikliği İngilizcede de yapın.
3. **Taslağa mı baktınız?** Canlı site yalnız yayınlanmış halini gösterir. Önizleme taslağı gösterir.
4. **Tarayıcı önbelleği:** Sayfayı yenileyin (Mac: `Cmd + Shift + R`, Windows: `Ctrl + F5`).
5. **Yine görünmüyorsa:** Yayınladıktan sonra birkaç dakika bekleyin. Yayınlama siteyi hemen yeniler. Toplu içe aktarımlarda en geç 1 saat sürebilir. Hâlâ yoksa teknik ekibe haber verin.

### Renk reddedildi

- Mesajdaki kontrast oranlarına bakın. Rengi biraz koyulaştırın veya açın.
- Ayrıntı için bölüm 5.3'e bakın.

### Görsel görünmüyor

1. **Korumalı mı?** İlk kayıtta korumalı olan görsel sonradan kutuyu kapatarak açılamaz. Tanıtım için yayımlanması uygun bir görseli yeni kayıt olarak korumasız yükleyip sayfada onu seçin (bölüm 6.4).
2. **Alt metin girildi mi?** Alt metin boşsa kayıt yapılmaz.
3. **Yüklendi mi?** Yükleme bitmeden seçmeye çalışırsanız görsel listede görünmez. Yükleme bitince tekrar deneyin.

### Video oynamıyor

- Poster görseli yüklü mü? Poster olmadan arka plan videosu kaydedilmez.
- Video MP4 veya WebM mi? Kısa video kullanın (öneri: en fazla 15 saniye; otomatik süre kontrolü yok).
- Video herkese açık mı? Korumalı video sitede oynamaz.
- Ziyaretçi mobil cihazda veya "hareketi azalt" açıkken poster görünür. Bu beklenen davranıştır.

### Kayıt sırasında hata

- **Ayrılmış adres hatası:** Landing sayfasının adresi sistemde ayrılmış. Farklı bir slug seçin (bölüm 4.2).
- **Zorunlu alan hatası:** Kırmızı işaretli alanı doldurun.

### Sayfayı kaybettim

- Silinen sayfalar yeniden açılamaz. Silmeden önce **Gizle** veya **Taslak** kullanın.
- Önceki sürümlere dönmek için sayfanın **Sürümler** sekmesine bakın.

---

## Özet

1. Ana sayfa ve sayfalar bloklardan oluşur. Blok ekleyin, sürükleyin, gerekirse gizleyin.
2. Taslak destekleyen içerikleri önizlemede kontrol edip **Değişiklikleri yayınla** deyin. Menü, footer, Site ayarları ve taslak desteği olmayan koleksiyonlarda **Kaydet** doğrudan siteye uygulanır.
3. Görseller korumasız, alt metinli ve çevirileri tamam olmalı. Renk ve görsel kuralları reddedilirse mesaja bakın.

> Not: Bir ürünü editörde bağlı bloklarla (kompozisyon modu) düzenlediyseniz ve seed eski düzende ise, `pnpm content:import` en son taslak/autosave düzenini iki dilde korur; diğer alanları günceller ve "layout korundu" uyarısı basar. Import yine yayınlar: yalnız taslakta olan düzen de yayına geçer. Seed de bağlı bloklarla kompozisyon içeriyorsa seed düzeni yazılır ve zorunlu "Sürümler ve Teklif İste" kuralı uygulanır. Seed düzenini kullanmak için seed'i geçerli bir kompozisyona dönüştürün. `--dry-run` aynı işlemi deneyip geri alır.

## Licensing and security center

This section is for administrators only. Editors cannot open licenses, devices or the security center.

### Where things are

- **Licenses:** the `licenses` collection in the admin panel. Open a license to see its status, reason, source, last change and devices.
- **License actions:** the "License actions" side panel on the license document. The status field is read-only in the form. The panel actions, payments and the rules engine can change status.
- **Devices:** the `license-activations` collection and the device list in the License actions panel (label, platform, IP prefix, last seen).
- **Security center:** `/admin/guvenlik` (nav link "Security center"). It has tabs for overview, events, blocks, status changes and signing keys. The audit trail and settings open their own admin screens.
- **Licensing settings:** the `licensing-settings` global in the admin panel (admin only).

### Actions on a license

- **Suspend:** active → suspended. Requires a reason. The customer gets an e-mail if customer suspension e-mails are on. Reversible with Restore.
- **Revoke:** active or suspended → revoked. Requires a reason and typing the last six characters of the license public ID. All active devices are released with reason "license revoked". Revoked is final; it cannot be undone.
- **Restore:** undoes the latest suspension only if it was a rule suspension or a manual suspension. Other cases are refused.
- **Reactivate:** lifts remaining suspensions that Restore does not cover (for example a payment dispute that was won). For rule or manual suspensions, use Restore.
- **Release device:** frees the seat; the device status becomes deactivated. The license status does not change.
- **Revoke device:** ends the device as an admin action. To stop a device from activating again, add a block (fingerprint block).

Every action asks for a reason and writes one status-history row (for license changes) and one audit row. A repeated request with the same request ID does nothing new.

### Security events and triage

- **Acknowledge:** marks an open event as seen.
- **Resolve:** closes the event.
- **False positive:** marks the event as a false alarm. For a rule suspension, "False positive + restore" also restores the license.
- Any triage of an open "rule circuit open" event closes the circuit breaker early.

### Blocks

- Add a block for an IP prefix (/24 for IPv4, /48 for IPv6), a CIDR range, a device, a fingerprint or a license.
- Durations: 1 hour, 24 hours, 7 days or no end date (admins only).
- If the block would cover your own trusted address, you must confirm it separately.
- Lift deactivates a block and keeps its record until retention cleanup. The local process refreshes immediately. Other running processes refresh when their block cache expires.

### Signing key rotation

- The "Signing keys" tab shows the active key ID and a rotate button.
- Rotation requires typing `DÖNDÜR` or `ROTATE`.
- Old keys still verify for 90 days. Revoking a key ends its verification immediately.
- Keys set by environment variables cannot be rotated from the panel.

### Monitor-only mode and automatic rules

- Rules run in one of four modes: off, observe, notify, suspend. New rules start in **notify**.
- Only **suspend** mode can suspend automatically. Automatic actions never revoke a license.
- Automatic suspension is blocked until the date in **rules → observeUntil** has passed. Until then, a would-be suspension is recorded and notified instead.
- Set observeUntil to a date in the past only after reviewing the events from the monitoring period.

### Circuit breaker

- **Max automatic suspensions per hour** (default 5). The next suspension beyond that limit is not executed. A critical "rule circuit open" event is recorded and an admin alert is sent.
- While the breaker is open, suspend-mode hits are only notified. It closes after the event is triaged or after 24 hours.
- Setting the limit to 0 turns automatic suspension off without tripping the breaker.

### Licensing settings (edited in the admin panel)

- **General:** API on or off, public host, lease length in days (default 14, maximum 30), refresh and clock-skew values.
- **Limits:** request and rate-limit thresholds for the API.
- **Rules:** mode and thresholds per rule, the observe-until date and the circuit-breaker limit.
- **Self-service:** the portal device release quota and the licensing API rebind quota.
- **Notifications:** alert e-mail recipients, immediate severity threshold, daily digest, customer suspension e-mails.
- **Retention:** how long each kind of record is kept. Minimum values are fixed in code and cannot be lowered below them.

Changes to these settings are recorded in the audit trail as old and new values. E-mail addresses are not written in the record.

### Sweep timer

- `pnpm licensing:sweep` runs the rule engine, the notification queue and, when requested, retention.
- It runs every 5 minutes through the `licensing-sweep` systemd timer on the server.
- Options: `--dry-run` reports decisions without writing or sending; `--retention` runs cleanup only.
- Retention runs during the 04:00 hour (Europe/Istanbul).
