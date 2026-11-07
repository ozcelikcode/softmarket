# Memory Bank

## Nedir
Memory Bank, yapay zekâ ajanının oturumlar arasında bağlamı kaybetmemesi için projenin kalıcı özetidir. Her oturumda ajanın hafızası sıfırlanır; proje bilgisi yalnızca bu dosyalardan ve kod tabanından gelir.

## Dosya hiyerarşisi

```
projectbrief.md          (temel: kapsam, kararlar, hedefler; tek doğru kaynak)
   ├── productContext.md  (neden var, UX, tasarım, palet)
   ├── systemPatterns.md  (mimari, desenler, kritik akışlar)
   └── techContext.md     (sürümler, kurulum, kısıtlar, araçlar)
            │
            ▼
      activeContext.md    (şu an: odak, son değişiklikler, sonraki adımlar)
            │
            ▼
       progress.md        (çalışanlar, kalanlar, bilinen sorunlar, karar evrimi)
```

- Üstteki dosyalar daha kararlıdır; alttakiler daha sık değişir.
- Çelişki olursa daha üstteki dosya esastır. `activeContext.md` ve `progress.md` güncel durumu gösterir.

## Zorunlu okuma
**Her görev başında `memory-bank/` altındaki TÜM dosyalar okunur.** Sıra: `projectbrief.md` → `productContext.md` → `systemPatterns.md` → `techContext.md` → `activeContext.md` → `progress.md`. Bu README'yi okumak da zorunludur.

Okumadan kod değiştirme, plan yapma veya commit önerme.

## Güncelleme tetikleyicileri
- **Yeni desen** veya mimari karar eklendiğinde → `systemPatterns.md` (ve gerekiyorsa `techContext.md`).
- **Önemli değişiklik** sonrası (faz tamamlandı, QA geçti, dosya/rota eklendi, komut değişti) → `activeContext.md` ve `progress.md`.
- **Kapsam veya karar değişirse** → `projectbrief.md` (kullanıcı onayıyla).
- **Kullanıcı "update memory bank" dediğinde** → TÜM dosyalar gözden geçirilir ve güncellenir.
- **Bağlam belirsizse** (eski bilgi şüphesi, dosyalar arası çelişki) → kodu ve kaynakları kontrol et, sonra ilgili dosyayı düzelt.

## Yazım kuralları
- Kısa, olgusal, taranabilir. Tahmin ve uydurma yok; emin değilsen "doğrulanmadı" yaz.
- Yollar, komutlar, sürümler ve teknik terimler aynen yazılır.
- Her bilgi bir yerde yazılır; tekrar yoktur.
- Tipik dosya 40-120 satır.
