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

1. **Blok ekle** düğmesine tıklayın.
2. Blok seçici, blokları gruplara ayırır: **Giriş, İçerik, Katalog, Kanıt, Dönüşüm, Yardımcı**.
3. İstediğiniz bloğu seçin. Bloğun önizleme görseli ve kısa açıklaması görünür.
4. Yeni blok, listenin sonuna eklenir. Sonra sürükleyerek yerini değiştirin.

### 2.3 Sıralama (sürükle-bırak)

- Her bloğun sol tarafındaki tutamaktan (altı nokta simgesi) tutun.
- Bloğu istediğiniz yere sürükleyip bırakın.
- Sıra değişikliği de taslak olarak kaydedilir. Yayınlamadan canlı siteye gitmez.

### 2.4 Blok silme ve kopyalama

- Bloğun sağındaki menüden **Sil** veya **Kopyala** seçin.
- Silinen blok geri alınamaz. Emin değilseniz önce **Gizle** kullanın (aşağıda).

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
| **Animasyon** | Bloğun görününce hafifçe belirmesi. | Hafif (görününce), yok. |
| **Ayraç çizgisi** | Önceki bölümle arasına ince çizgi. | Yok, üstte ince çizgi. |
| **Anchor (bağlantı kimliği)** | Sayfa içi bağlantı için ad. Örnek: `avantajlar` yazarsanız adres `.../sayfa#avantajlar` olur. | Yalnız küçük harf, rakam ve tire. En fazla 40 karakter. Aynı sayfada iki blokta aynı ad olamaz. `main`, `ozellikler`, `genel-bakis`, `teknik-ozellikler`, `surumler`, `indirmeler`, `dokumantasyon` ayrılmıştır. |
| **Bloğu gizle** | Bloğu sitede gizler. | Açık/kapalı. |

Önemli notlar:

- Animasyonu tüm site için kapatmak da mümkündür. Bu ayar **Site ayarları** içindedir (bölüm 5).
- Bağlantı adı (anchor) yalnız sayfa içi bağlantılarda işe yarar. Boş bırakabilirsiniz.

### 2.7 Taslak ve yayın

SoftMarket'te iki durum vardır:

- **Taslak:** Değişiklik kaydedilir ama siteye çıkmaz. Ziyaretçiler görmez.
- **Yayında:** Ziyaretçiler görür.

Kurallar:

1. **Taslak olarak kaydet** düğmesi değişikliği saklar. Canlı siteye etkisi yoktur.
2. **Yayınla** düğmesi değişikliği siteye çıkarır.
3. Yayınlanmamış bir sayfa, yayında olan sürümün yerine geçmez. Siteye yalnız yayınlanmış hali gider.
4. Yayınladığınızda site önbelleği yenilenir. Değişiklik genellikle hemen görünür (bölüm 9'a bakın).

### 2.8 Otomatik kayıt

- Sayfa düzenlenirken değişiklikler yaklaşık **2 saniye** sonra otomatik kaydedilir.
- Bu kayıt **taslak** olarak yapılır. Yayına çıkmaz.
- Otomatik kayıt, Live Preview'un güncel kalması için vardır.

### 2.9 Live Preview (canlı önizleme)

Live Preview, değişikliğinizi sitenin gerçek görünümünde gösterir. Sayfa düzenleme ekranında **Önizleme** sekmesini açın.

1. Önizleme, sayfanın taslak halini gösterir. Yayında olmayan değişiklikler de görünür.
2. Üst kısımdaki düğmelerle ekran boyutunu seçin:
   - **Mobil** (telefon)
   - **Tablet**
   - **Masaüstü**
3. Kaydettiğinizde önizleme yaklaşık 2 saniye içinde yenilenir.
4. Önizlemeyi kapatmak için **Önizlemeden çık** düğmesine basın. Bu düğme, önizleme sayfasını açık tutarken de görünür.

Önizleme yalnız giriş yapmış editör ve yönetici için açılır. Ziyaretçiler taslakları göremez.
Live Preview; sayfalar, ürünler, ürün aileleri, çözümler, referanslar ve haberlerde vardır. **Şablon** sayfalarında public önizleme yoktur. İlişkili içerik listeleri önizlemede de yalnız yayınlı kayıtları gösterir. Yaklaşık 2 saniyelik otomatik kayıt yalnız **Sayfalar** için açıktır; diğer koleksiyonlarda kaydetmeniz gerekir.

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

1. **Sayfalar** bölümünde **Yeni** düğmesine basın.
2. Sayfa türünü **Landing** seçin.
3. Başlık ve slug (adres) girin.
4. Türkçe ve İngilizce alanlarını doldurun (bölüm 8).
5. Blokları ekleyin ve sıralayın.
6. **Yayınla** düğmesine basın.

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
2. Üst menüden **Çoğalt (Duplicate)** seçin.
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
2. **Yeni yükle** düğmesine basın ve dosyayı seçin.
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

1. **Yayınladınız mı?** Taslak olarak kaydetmek siteye yansımaz. Sayfanın üstündeki **Yayınla** düğmesine basın.
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
2. Taslak destekleyen içerikleri önizlemede kontrol edip **Yayınla** deyin. Menü, footer, Site ayarları ve taslak desteği olmayan koleksiyonlarda **Kaydet** doğrudan siteye uygulanır.
3. Görseller korumasız, alt metinli ve çevirileri tamam olmalı. Renk ve görsel kuralları reddedilirse mesaja bakın.
