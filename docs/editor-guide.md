# SoftMarket editor guide

This guide is for editors and administrators managing the website. No technical knowledge is required. All steps are performed through the admin panel.

---

## 1. Getting started

### Logging in to the admin panel

1. Open the following address in your browser: **http://127.0.0.1:3100/admin**
2. Sign in with your email and password.

### First administrator account

- The first user in the system automatically becomes an **administrator (`admin`)**.
- Subsequent users can only be added by an administrator.
- An administrator can also edit their own account.

### Roles

| Role | What they can do |
|---|---|
| **Administrator (`admin`)** | Everything: content, menu, site settings, users, licenses. |
| **Editor** | Adds, edits, and publishes content; edits menu and footer. Can read staff records and edit their own account; cannot add/delete users or change roles. Has no write permission for Licenses or Site settings. |

Customers cannot log in to the admin panel. Customer accounts work only in the customer area on the website.

---

## 2. Editing the home page

The home page is a record in the **Pages** (`Sayfalar`) collection. A page consists of blocks. Blocks appear in order from top to bottom.

### 2.1 Opening the page

1. Open the **Pages** (`Sayfalar`) section from the left menu.
2. Open the page whose slug is `home`. If another home page is selected in Site settings, open that one.
3. On the page edit screen, you will see the **Page blocks** (`Sayfa blokları`) field. Blocks are listed here.

The home page's first **Hero** (`Giriş`) block is the page's main heading. Keep this block at the top of the page.

### 2.2 Adding a block

1. Click the **Add block** (`Blok ekle`) button at the bottom of the block list. To insert directly below a specific block, select **Add below** (`Altına ekle`) from the **···** menu on the right of that block.
2. The modal groups blocks into categories: **Hero** (`Giriş`), **Content** (`İçerik`), **Catalog** (`Katalog`), **Proof** (`Kanıt`), **Conversion** (`Dönüşüm`), **Utility** (`Yardımcı`).
3. Select the block you want. A preview image and short description of the block appear.
4. A block added with the bottom button is appended to the end of the list; a block added with **Add below** is placed under the selected block. You can drag it to reorder afterward.

### 2.3 Reordering (drag and drop)

- Grab the handle (six-dot icon) on the left side of each block.
- Drag and drop the block where you want it. If dragging is difficult, use **Move up** (`Yukarı taşı`) / **Move down** (`Aşağı taşı`) in the block's **···** menu.
- Order changes are also saved as a draft. They do not go to the live site until published.

### 2.4 Deleting and duplicating blocks

- The **···** menu on the right of a block has these options: **Move up** (`Yukarı taşı`), **Move down** (`Aşağı taşı`), **Add below** (`Altına ekle`), **Duplicate** (`Çoğalt`), **Copy row** (`Satırı kopyala`), **Paste row** (`Satırı yapıştır`), **Remove** (`Kaldır`).
- **Duplicate** inserts a copy of the block immediately below. **Remove** deletes the block (there is no "Delete" in the menu).
- Because the page autosaves drafts every ~2 seconds, a removed block is saved. To undo, restore a previous version from the page's **Versions** (`Sürümler`) tab. If unsure, use **Hide block** (`Bloğu gizle`) first (below).

### 2.5 Hiding a block

To hide without deleting:

1. Open the block.
2. Open the **Appearance** (`Görünüm`) section.
3. Check the **Hide block** (`Bloğu gizle`) box.

A hidden block does not appear on the site, but its content is not lost. Uncheck the box to show it again.

### 2.6 "Appearance" settings

Every block has an **Appearance** (`Görünüm`) section. Default settings are sufficient in most cases. The settings are:

| Setting | What it does | Options |
|---|---|---|
| **Theme** (`Tema`) | Background color of the block. | Auto (block default), light, dark. |
| **Vertical spacing** (`Dikey boşluk`) | Space above and below the block. | None, small, medium, large. |
| **Alignment** (`Hizalama`) | Alignment of heading and text. | Left, center. |
| **Width** (`Genişlik`) | Width of block content. | Narrow, normal (default), wide. |
| **Animation** (`Animasyon`) | Master switch for block motion. If **None** is selected, the effect in the **Motion** section will not run either (section 2.6a). | Subtle (on reveal), none. |
| **Divider line** (`Ayraç çizgisi`) | Thin line between this and the previous section. | None, thin line on top. |
| **Anchor (link ID)** | Name for in-page links. Example: entering `avantajlar` creates the URL `.../page#avantajlar`. | Lowercase letters, digits, and hyphens only. Max 40 characters. Two blocks on the same page cannot share the same name. `main`, `ozellikler`, `genel-bakis`, `teknik-ozellikler`, `surumler`, `indirmeler`, `dokumantasyon` are reserved. |
| **Hide block** (`Bloğu gizle`) | Hides the block on the site. | On/off. |

Important notes:

- You can also turn off animation for the entire site. That setting is in **Site settings** (section 5).
- The anchor name is only useful for in-page links. You can leave it blank.

### 2.6a "Motion" (animation effects)

Right below **Appearance** is the **Motion** (`Hareket`) section. You can choose a preset effect for each block so the page does not look flat. Freeform animation is not offered: only tested presets are provided for speed and mobile compatibility.

**Effect cards.** A small preview box plays on top of each card. The **Replay** (`Tekrar oynat`) button restarts the previews. Cards:

| Effect | What it does |
|---|---|
| **Auto** (`Otomatik`, default) | Today's subtle fade-in. If you change nothing, the site looks as before. |
| **None** (`Yok`) | Block appears without motion. |
| **Fade** (`Belirme`) | Gently fades in in place. |
| **Slide up / down** (`Yukarı / Aşağı kayma`) | Slides in from below or above. |
| **Slide left / right** (`Sola / Sağa kayma`) | Slides in from right or left. |
| **Zoom in** (`Yakınlaşma`) | Slightly scales up as it appears. |
| **Parallax** (`Paralaks`) | Content subtly separates from the background as you scroll. By default, runs only on tablet and desktop. |
| **Stagger** (`Sırayla`) | In card/list blocks, cards appear one by one. In other blocks, parts of the block enter sequentially. |

**Advanced** (`Gelişmiş`, below the cards, collapsed by default):

| Setting | Options |
|---|---|
| **Trigger** (`Tetikleyici`) | On scroll (once when visible, default) · Linked to scroll progress · On page load · On hover |
| **Duration** (`Süre`) | Fast (240 ms) · Base (560 ms, default) · Slow (800 ms) |
| **Delay** (`Gecikme`) | None · 100 · 200 · 300 ms |
| **Easing** (`Hız eğrisi`) | Soft (default) · Standard · Emphasized |
| **Stagger interval** (`Sırayla aralık`) | None · Tight (60 ms, default) · Relaxed (100 ms). Total max 300 ms. |
| **Enable parallax on mobile** | Visible only when Parallax is selected. |

Rules and tips:

- **Speed rule (automatic):** The first visible content of a page and any Hero block cannot use an effect that starts invisible on load (fade/zoom-in/stagger). If selected, the site automatically converts it to a short slide so content always stays visible. Hidden, empty, or potentially empty-result starting blocks do not consume this protection; subsequent blocks can also be protected until content is guaranteed. On a Hero block, only slide and parallax cards are shown.
- **On hover** does not hide content; it moves slightly when hovered with a mouse or when a link/button inside receives keyboard focus. Keyboard focus also works with a keyboard attached to a touch device.
- **Linked to scroll progress** and **Parallax** run only in supporting browsers; in others the block stays static and fully visible.
- If "reduce motion" is enabled on the visitor's device or **Site settings → Animation: Off**, no effects play.
- Use sparingly: 2–3 different effects per page are enough. Repeating the same effect on consecutive blocks looks calmer.
- You can preview the change in **Live Preview** or draft preview; the effect replays when the page reloads.

### 2.7 Draft and publish

SoftMarket has two states:

- **Draft:** The change is saved but not published to the site. Visitors do not see it.
- **Published:** Visitors see it.

Rules:

1. The **Pages** and **Products** collections do not have a "Save draft" button: changes are already autosaved as drafts (section 2.8) with no effect on the live site. Collections with drafts and no autosave, such as Solutions, have a **Save draft** (`Taslağı kaydet`) button.
2. The **Publish changes** (`Değişiklikleri yayınla`) button at the top right pushes the change to the site. The arrow next to it opens the option to publish only the current language, such as **Publish in Turkish** (`Türkçe dilinde yayınlayın`).
3. A draft change made to an already published page appears in the top bar as **Status: Changed** (`Durum: Değişiklik yapıldı`). To discard the draft and revert to the published version, use the **Revert to published** (`Yayınlanana geri döndür`) link.
4. To remove a page from the site completely, select **Unpublish** (`Yayından Kaldır`) from the **⋮** menu at the top right.
5. An unpublished page does not replace the published version. Only the published version goes to the site.
6. When you publish, the site cache is refreshed. The change usually appears immediately (see section 9).

### 2.8 Autosave

- While editing a page or product, changes are automatically saved after about **2 seconds**.
- This save is stored as a **draft**. It is not published.
- Autosave exists so that Live Preview stays up to date.

### 2.9 Live Preview

Live Preview shows your change in the real appearance of the site. On the page edit screen, click the **eye icon** (Preview) to the left of **Publish changes** at the top right. The screen splits in two: form on the left, live preview on the right. Clicking the eye icon again closes the preview. The **Edit / Versions / API** (`Düzenle / Sürümler / API`) tabs at the top do not open preview; there is no separate tab named **Preview**.

1. Preview shows the draft state of the page. Unpublished changes are also visible.
2. In the bar above the preview, select the screen size from the **Responsive** dropdown:
   - **Mobile** (`Mobil / Mobile`, phone)
   - **Tablet**
   - **Desktop** (`Masaüstü / Desktop`)

   You can enter custom dimensions in the width × height boxes next to it, change the zoom level (50%–200%), and open the preview in a new tab with the rightmost icon.
3. As you type, the preview refreshes within about 2 seconds (via autosave).
4. The **Exit preview** (`Önizlemeden çık`) button on the banner shown while in draft mode on the site turns off draft mode. To close the Live Preview panel, use the eye icon.

Preview opens only for logged-in editors and administrators. Visitors cannot see drafts.
Live Preview is available on pages, products, product families, solutions, case studies, and news. **Template** (`Şablon`) pages have no public preview. Related content lists in preview also show only published records. ~2-second autosave is enabled for **Pages** and **Products**; in other collections you must save manually.

### 2.10 Visual edit (pages and products)

Opening **Pages** and **Products** records launches the **visual editor** directly: the real site view on the right (large canvas), and a narrow form panel on the left. The canvas is identical to the published page, with only editing frames added. The visual editor is visible only to administrators and editors; visitors and customer accounts cannot open it.

**Top bar** (to the left of the Save/Publish buttons):

| Button | What it does |
|---|---|
| **Switch to classic form / Visual edit** (`Klasik forma geç / Görsel düzenle`) | Switches to form-only and back with one click. Classic form is per-visit; the next time you open the record, the visual editor opens again. |
| **↶ / ↷** | Undo / redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`). Reverts changes in the form and on the canvas step by step (up to 50 steps). |
| **390 / 768 / 1440 / Fit** (`Sığdır`) | Preview width: phone, tablet, desktop, fit to panel. |
| **TR / EN** | Content language. Pending changes are saved before switching. |
| Status text | Saving… / Draft saved / Unsaved changes. |
| **Tips** (`İpuçları`) | Reopens the 4-step quick tour (the tour appears automatically once on first open). |

**Working with blocks (on canvas):**

1. Click a block: it is **selected** with a blue frame, that block's row opens in the form, and the **Appearance** and **Motion** (including Advanced) groups appear. You configure media, rich text, link URLs, and effect settings there.
2. Selected block toolbar: **↑ / ↓** move, drag from the **⠿** handle and drop above/below another block, **Edit text** (`Metni düzenle`), **Duplicate** (`Çoğalt`), **Hide / Show** (`Gizle / Göster`), **Delete** (`Sil`, confirmed on second click), **+ Add block** (`+ Blok ekle`, below the selected block; block list with thumbnails and search box).
3. **In-place text editing:** click again on a text element in the selected block (heading, eyebrow, intro, button label, card title/description, table row, FAQ question…) and type. **Enter** commits, **Esc** cancels. Pasted content is converted to plain text. Multi-line text or text over 1000 characters, rich text, images, and link URLs are edited in the form.
4. **Hidden blocks** appear dimmed on the canvas with a `Gizli: ziyaretçiler görmez` ("Hidden: visitors do not see this") badge; select and click **Show** (`Göster`) to unhide. They never appear on the published page.
5. **Keyboard:** after clicking the canvas, **↑ / ↓** selects the previous/next block, **Alt+↑ / Alt+↓** moves the selected block, **Enter** edits the first text, **Delete** deletes on two presses, **Esc** clears selection.

**Product page rules:** `Ürün: Giriş` ("Product: Hero") is always the first block (cannot be moved, deleted, or hidden). `Ürün: Sürümler ve Teklif İste` ("Product: Editions & Request a Quote") is mandatory: it can be moved, but not deleted or hidden. Product sections cannot be duplicated. On a product in legacy layout (without section blocks yet), the first move/add/hide action **automatically** converts sections into editable blocks; duplicate blocks that were hidden in legacy layout (e.g., a second Hero) are added hidden so the page appearance does not change. Product title, tagline, summary, and feature cards can also be edited in place (written to the product record).

**Language (TR/EN):** If a field is empty in EN, the canvas shows the TR text as a fallback; clicking it shows a `Bu dilde metin yok` ("No text in this language") warning, and what you type is saved only to EN. If you type nothing, EN remains empty (TR text is not copied).

**Saving and conflicts:** Changes are autosaved as drafts within ~2 s. If you close the tab or switch to another tab, pending changes are sent immediately. If the record was modified elsewhere (MCP, another tab, content import), your next save is **rejected** by the server (the other change is never overwritten) and a banner appears at the top; what you typed stays on screen. **Merge and save** (`Birleştir ve kaydet`) fetches the latest version and merges independent field and block changes by row ID. If the same text, rich text, row deletion, or ordering conflicts on both sides, it does not save and lists the fields; copy your changes and reload. A successful merge clears prior undo history. **Copy my changes** (`Değişikliklerimi kopyala`) outputs the fields you modified as text. **Reload** (`Yeniden yükle`) loads the latest version; unsaved changes are lost (asks for confirmation). If two users open the same record at the same time, Payload's document lock warns the second user. Visitors see the change after **Publish changes**.

**Limits:** If you open preview in a separate window (popup icon), editing tools do not work; use the canvas inside the panel. Undo inside rich text is the rich text box's own undo. The visual editor for solutions, case studies, and product families is planned for a later release (Live Preview is available).

---

## 3. Block catalog

Every block has an **Appearance** section (section 2.6). Below are only each block's own settings.

### 3.1 Hero (`Giriş`)

The top section of a page. Contains a heading, description, and up to **2 buttons**.

- **Layout (variant):**
  - **Cinematic** (`Sinematik`, default): Grid and glow effect. Media on the right.
  - **Split** (`İkiye bölünmüş`): Text on the left, media on the right.
  - **Centered** (`Ortalanmış`): Text centered, media below.
  - **Minimal** (`Sade`): No decoration. Text only.
  - **Background image / video** (`Arka plan görseli / videosu`): Full-width background.
- **Right panel** (when layout is Cinematic or Split): Choose an image or product families list (automatic).
- **Fields:** Eyebrow, heading (required), description, image, buttons.

#### Background video rules

- You can upload a video when layout **Background image / video** is selected.
- Recommended maximum video duration is **15 seconds**; the system does not check duration automatically.
- Video must be **muted** and **looped**. Format: **MP4** or **WebM**.
- Upload the video as **public**. That is, do **not** check the **Protected** (`Korumalı`) box.
- **A poster image is required.** If a video is uploaded, a poster must also be uploaded.
- Video loads only at **768 pixels** width or wider, and only when the visitor's "reduce motion" and data-saver settings are off. If site animation is off, the poster is shown instead.
- On mobile devices and when these settings are on, the poster image is shown. Therefore the poster should also be a good image.

### 3.2 Feature grid (`Özellik ızgarası`)

Displays short feature cards in a grid.

- **Columns:** 2, 3, or 4.
- **Style:** Cards (bordered) or plain (borderless).
- For each feature: icon, title (required), description.
- **If you select an image**, the image is shown instead of the icon.

### 3.3 Media + text (`Medya + metin`)

Places an image and text side by side.

- **Image position:** Left or right.
- Heading, rich text, and up to **2 buttons**.

### 3.4 Spec table (`Teknik tablo`)

Displays product specifications in a table.

- Organized in groups. Each group has a title and rows.
- Each row: **spec** (`özellik`) and **value** (`değer`).

### 3.5 Stats (`Rakamlar`)

Displays large numbers. Example: `500+`, `%99,9`.

- Up to **6** stats.
- Each stat: value, label, optional description.

### 3.6 Logo wall (`Logo şeridi`)

Displays customer and partner logos.

- Select **Source**:
  - Manually added logos
  - Case study customers (automatic from case studies)
  - Partners
  - All partners (automatic)
  - All case study customers (automatic)
  - Partners and case studies (automatic)
- **Max logos:** between 1 and 24.
- When adding manually, each logo's **name** is required. Link is optional.

### 3.7 Call to action (`Çağrı bandı`, CTA)

Directs the visitor to an action. Example: "Request a quote".

- **Style:** Band (dark, glowing), card (centered), inline (text on the left, buttons on the right).
- Heading is required. Body text is optional.
- **1 to 2** buttons.

### 3.8 Frequently asked questions (`SSS`)

Question-and-answer list. Works with accordions.

- **Source:**
  - **Select from FAQ collection:** Choose from pre-created FAQ records.
  - **Write in this block:** Write questions directly in this block.
- Every question and answer is required.

### 3.9 Rich text (`Zengin metin`)

Freeform text block. You can add headings, paragraphs, lists, and links.

- **Text width:** Narrow, normal, or wide.
- Text is written **separately in each language** (section 8).

### 3.10 Video

Displays a YouTube or Vimeo video.

- Only YouTube or Vimeo URLs starting with **https** are accepted.
- Video appears as a lightweight cover image on initial load. It loads when the visitor clicks. This keeps the page fast.

### 3.11 Media / gallery (`Görsel / galeri`)

Single image or image grid.

- **1 image:** full width.
- **2 to 4 images:** side by side in a grid.
- **Aspect ratio:** Original ratio (no crop), 16:9, 4:3, square (1:1), or wide (21:9). Choosing a fixed ratio crops the image to fill.
- A caption for each image is optional.

### 3.12 Testimonial (`Müşteri görüşü`)

Displays a quote from a customer.

- **Quote** and **author** are required.
- Title, company, photo, and company logo are optional.
- Use a public image for photo and logo.

### 3.13 Tabs (`Sekmeler`)

Displays multiple sections using tabs. Visitors switch by clicking a tab.

- **2 to 6** tabs.
- Each tab's label is required.
- Each tab can contain rich text and an optional image.

### 3.14 Spacer (`Boşluk`)

Adds empty space between blocks.

- **Height:** Small, medium, large, extra large.
- For background color, use **Appearance > Theme**, not the spacer block.

### 3.15 Divider (`Ayraç`)

Places a line between blocks.

- **Hairline** (`İnce çizgi`): Plain line.
- **Accent** (`Vurgu rengi`): Short centered accent line.

### 3.16 Product families (`Ürün aileleri`)

Displays product families as cards.

- **Source:** All families (automatic) or manually selected families.
- **Show product count:** Displays how many products are in each family.

### 3.17 Product showcase (`Ürün vitrini`)

Highlights selected products.

- **Source:**
  - Featured products
  - All products
  - Manually selected products
  - By family (select a product family)
  - By industry (select an industry)

### 3.18 Solutions (`Çözümler`)

Displays solution cards.

- **Source:** All solutions, manually selected solutions, or by industry.

### 3.19 Featured case study (`Öne çıkan vaka`)

Displays a case study as a large card.

- **Source:**
  - Featured case study (or latest if none)
  - Latest case study
  - Manually selected case study
  - By industry
- **Show outcome metrics:** Displays metrics from the case study.
- **Case link:** Link text and URL are optional. If left blank, links to the case study's own page.

### 3.20 News list (`Haber listesi`)

Displays news, posts, or events.

- **Source:**
  - Latest news
  - By category (news, product update, event, blog)
  - Manually selected news
- You can also select **Max items**, **Sort order**, and **Layout**.

### 3.21 Listing (`Liste`) block

This block can be selected in the **Pages** collection; it only functions on **system pages** (section 4). It does not generate a list on the home page or landing pages.

- Determines the placement of the page's own list: products, solutions, news, case studies, careers, partners, support, contact.
- The listing block has no content fields. You only change its position and **Appearance** settings.
- If the block is absent, the list appears immediately below the hero.
- To hide the list, set the block to **hide** (section 2.5).

---

## 4. System pages and new landing pages

### 4.1 System pages

System pages are special pages of the site. There is only **one** of each:

| Page | URL (TR) |
|---|---|
| Products (`Ürünler`) | `/tr/urunler` |
| Solutions (`Çözümler`) | `/tr/cozumler` |
| News (`Haberler`) | `/tr/haberler` |
| Case studies (`Referanslar`) | `/tr/referanslar` |
| Careers (`Kariyer`) | `/tr/kariyer` |
| Partners (`İş ortakları`) | `/tr/is-ortaklari` |
| Support (`Destek`) | `/tr/destek` |
| Contact (`İletişim`) | `/tr/iletisim` |
| About (`Hakkımızda`) | `/tr/sirket/hakkimizda` |

Each system page consists of two parts:

1. **Hero:** Eyebrow, heading, and description. If you leave a field blank, the site's default text is used.
2. **Blocks:** Blocks you add below the hero. The listing block can be placed among these blocks.

Rule: If you leave one of the hero fields blank, the default text from the translation file appears in that field. Enter your own text to override it.

### 4.2 Creating a new landing page

A landing page is a new page for a campaign or product launch.

1. In **Pages**, click **Create new** (`Yeni oluştur`).
2. Set page type to **Landing**.
3. Enter title and slug (URL).
4. Fill in both Turkish and English fields (section 8).
5. Add and order blocks.
6. Click **Publish changes**.

URL:

- Turkish: `/tr/<slug>`
- English: `/en/<en-slug>`

#### Reserved slugs

The following slugs are used by the system and cannot be used for a landing page:

- `urunler`, `products`, `cozumler`, `haberler`, `hesap`, `admin`, and similar names.
- These names return an error on save. Choose a different slug.

The technical team has the full list of reserved names.

#### Duplicating from a template

To reuse a ready-made page structure:

1. Open a record whose page type is **Template** (`Şablon`). Templates **never appear** on the live site.
2. From the **⋮** menu at the top right, select **Duplicate** (`Çoğalt`). A `Sayfa başarıyla kopyalandı.` ("Page successfully duplicated.") message appears.
3. The new copy opens. The copy's system page link comes empty.
4. Change the page type from **Template** to **Standard** or **Landing page**; otherwise the copy will not appear on the site even if published.
5. Change the title and the slug in both languages, then publish.

### 4.3 Configuring page links

There are two ways to link to another page:

- **Link to page:** Select link type **Internal** (`Site içi`) and pick the page from the list. When language changes, the page URL updates automatically for that language.
- **Built-in site route:** Select link type **Site page (route)** (`Site sayfası (yol)`). Pick one of the built-in routes. Example: Products.

---

## 5. Menu, footer, and site settings

The header and footer can be edited by administrators or editors; **Site settings** (`Site ayarları`) can only be edited by administrators. There is no draft/publish split in these three sections: **saving applies the change to the site immediately**.

### 5.1 Header (`Üst menü`)

- **Menu items:** Link, label, and optional dropdown menu for each item.
- **Dropdown (mega menu):**
  - **Products** or **Solutions** are listed automatically.
  - Selecting **Custom** (`Özel`) lets you enter your own columns and featured card.
- **Buttons:** Up to **2** buttons.
- **Utility area:** Search icon, language switcher, and customer account link can be toggled on/off.
- **Announcement bar:** A thin bar at the very top of the page. Visible when **Show** (`Göster`) is on and text is filled. If **Visitor can dismiss** (`Ziyaretçi kapatabilir`) is on, visitors can close it.

### 5.2 Footer (`Alt bilgi`)

- **Columns:** Heading and link list.
- **Legal links:** Privacy, terms of use, etc.
- **Brand description:** Short text.
- **Show contact info:** Displays contact information from Site settings in the footer.
- **Show social links:** Displays social media links from Site settings.
- **Newsletter fields:** Present in the panel; the current frontend footer does not render a newsletter form.
- **Copyright text:** Typing `{year}` inserts the year automatically. Typing `{siteName}` inserts the site name.

### 5.3 Site settings

#### Identity

- **Site name** (required): Appears in browser tab and search results.
- **Tagline:** Short introductory sentence.
- **Logo:** Logo used on light backgrounds.
- **Dark logo:** Logo used on dark backgrounds. If left blank, the light logo is used.
- **Favicon:** Small icon in the browser tab.
- **Default share image:** Image shown when shared on social media.

If logo is left blank, the site displays its built-in default logo.

#### Brand and motion

- **Accent color (hex):** Color for buttons and accents. Example: `#2f5fe0`.
  - If left blank, the site's default colors are used.
  - The color must pass the **contrast** rule (below).
- **Animation:**
  - **Subtle:** Blocks gently fade in when revealed.
  - **Off:** All animations stop. Applies to the entire site.

#### If a color is rejected

The accent color is saved only if it passes the readability rule. The entered color must meet **4.5:1** contrast (WCAG AA) in at least **one theme** for both text/links on backgrounds and text on buttons. Suitable tones for the other theme and hover state are derived automatically. A color failing the rule in both themes is rejected. When rejected, the message reads:

> Contrast insufficient (WCAG AA min 4.5:1): dark theme X:1, light theme Y:1. Choose a darker or lighter shade. (`Kontrast yetersiz (WCAG AA en az 4,5:1)...`)

What to do:

1. Check the ratios in the message. See which theme is too low.
2. Make the color slightly **darker** (on light background) or **lighter** (on dark background).
3. Enter the new value and save.
4. If still rejected, try another shade under the same rule. Contact the technical team if help is needed.

The color must be in hex format. Enter a 3- or 6-digit code starting with `#`; short codes expand to 6 digits on save. Invalid format shows: `Enter a hex color like #2f5fe0.` (`#2f5fe0 gibi bir hex renk girin.`)

#### Contact

- **Email, sales email, support email, phone, address, map URL, working hours.**
- Any field you leave blank is **hidden** on the site. For example, if there is no address, the address line does not appear at all.

#### Social links

- Choose platform (e.g., LinkedIn, X, YouTube) and enter the full link URL.
- Link URL is required.

#### Company details

- Company title, tax office, tax ID, MERSIS number, and KEP address are stored; the current frontend does not automatically insert them into the footer or legal texts. Edit legal page texts separately.

#### Home page selection

- In the **Home page** (`Ana sayfa`) field, select which page will be the home page.
- If left blank, the system looks for the page with slug `home`.
- If neither exists, the site's built-in fallback home page is shown.

---

## 6. Media (images, videos, files)

### 6.1 Uploading

1. Open the **Media** (`Medya`) section from the left menu.
2. Click **Create new** (`Yeni oluştur`), then choose the file with **Select a file** (`Dosya seç`) (or drag and drop; can also fetch from URL via **Paste URL** / `URL yapıştır`). In image fields on page/product forms, the same is done via **Create new** and **Choose from existing** (`Varolanlardan seç`).
   Click **Save** (`Kaydet`) after uploading.
3. Fill in the fields after the image is uploaded.

### 6.2 Alt text (required)

- **Alt text** is required for every image. Written separately in Turkish and English.
- Alt text describes what the image shows for visually impaired users and search engines.
- Example: "Screenshot of enterprise software dashboard".
- Write a short description even for decorative images.

### 6.3 Focal point

- If an image is cropped to a box, you can choose a **focal point** so the important part stays visible.
- Click a point on the image. The cropped area centers on that point.

### 6.4 Protected or public?

- **Public (`Korumalı` / Protected box unchecked):** Any visitor can view it. Select this for marketing images on the site.
- **Protected file** (`Korumalı dosya`) is checked by default. Create marketing images **at initial upload** with this box unchecked. Unchecking the box on an already saved protected file does not remove protection.
- **Protected:** Staff can view it. A customer simply being logged in is not enough: they need a valid license for the relevant product and a download record or licensed media mapping authorizing the file. If the subscription has not started, has expired, or the license is suspended/revoked, they cannot access it.
- Media linked to a **Downloads** (`İndirmeler`) record must be protected. If the download record's **Access** (`Erişim`) field is set to **Public** (`Herkese açık`), the file is also open to anonymous visitors; if set to **Licensed customers** (`Lisanslı müşteriler`), a valid product license is required. A public download linked to the same file opens that file to everyone.
- For a marketing image saved as protected by mistake, upload only a file permitted for publication as a new unprotected media record and switch the selection on the page. Do not expose confidential or licensed files this way.

### 6.5 Automatic sizes and format

- For supported raster images, four derivatives are generated if source size is sufficient: **400, 768, 1280, and 1920 pixels** wide. The same derivatives should not be expected for files like SVG/GIF.
- Derivatives are in **WebP** format; the original file is also preserved.
- No upscaling is performed. If the image is already small, larger sizes are not generated.
- Size files follow the same protection rule. Smaller sizes of a protected image are not public either.
- If you replace the image, sizes update automatically.
- Recommended width: at least **2400 pixels**. Larger images look sharper; the system generates the required sizes itself.

### 6.6 Location metadata is stripped

- On new or replaced **JPEG, PNG, WebP, TIFF, HEIC/HEIF** uploads, **GPS, EXIF, XMP, and IPTC** metadata is stripped. HEIC/HEIF processing depends on codec support on the server; if stripping fails, the upload is rejected.
- Photos open in the right orientation. That is, vertical photos taken on a phone do not appear sideways.
- Color profiles may be preserved. Existing files and **SVG, GIF, video, and PDF** are not covered by this stripping; hidden metadata is not automatically removed from them.

### 6.7 Video and PDF

- Rules for background video on the site are in section 3.1.
- Product files and PDFs are uploaded as protected in **Media**; then this media is selected in a **Downloads** record to set the product and access level.

---

## 7. Products, editions, and quotes

### 7.1 No pricing

- No **prices are shown** on the SoftMarket site. There is no online payment.
- Every edition has a **Request a Quote** (`Teklif İste`) button.
- The visitor submits a quote request. The team prepares the quote.

### 7.2 Product and edition structure

- **Product family:** Top-level group. Example: "Accounting".
- **Product:** Product under the family. Example: "Accounting Pro".
- **Edition:** Package or license type of the product. Every edition has a **SKU** code.

### 7.2a Product page layout (product blocks)

Sections on a product page are blocks starting with **`Ürün:`** ("Product:"): Hero (`Giriş`, title + Request a Quote), Tab bar (`Sekme çubuğu`), Overview (`Genel bakış`), Features (`Özellikler`), Technical specs (`Teknik özellikler`), Editions & Request a Quote (`Sürümler ve Teklif İste`), Downloads (`İndirmeler`), Documentation (`Dokümantasyon`). In the block picker they are under the **Product page sections** (`Ürün sayfası bölümleri`) group.

- No text is written in these blocks. Title, summary, features, spec table, editions, downloads, and docs are read from the product record (and linked edition/download/doc records). To change section content, edit the relevant tab of the product.
- **If Page blocks is empty** (or contains only extra blocks like FAQ, CTA), the page renders in the default order: Hero, Tab bar, Overview, Features, Technical specs, Editions, Downloads, Documentation, followed by extra blocks.
- **Once you add the first `Ürün:` block, you control the order:** sections render in the list order; any section not in the list is not shown. Therefore, when switching from the default layout, add all sections you want to use.
- **`Ürün: Sürümler ve Teklif İste` ("Product: Editions & Request a Quote") is mandatory.** It can be reordered, but cannot be deleted or hidden; attempting to save/publish after removing this block is rejected with an error (including autosave). The **Request a Quote** button on each edition card opens the quote form with the edition's SKU.
- **`Ürün: Giriş` ("Product: Hero")** carries the page title (`h1`), breadcrumb, and top Request a Quote button; it is always the first block and cannot be hidden. If you do not add it, the page still shows the default hero at the top.
- Downloads, Documentation, and Tab bar are optional: you can move, hide, or delete them. The tab bar links only to sections visible on the page.
- The `Ürün: Teknik özellikler` ("Product: Technical specs") block has a **Show system requirements** (`Sistem gereksinimlerini göster`) option.
- Every product block has **Appearance** (theme, spacing, alignment, divider) and **Motion** (section 2.6a) settings. Because section IDs are fixed, there is no anchor field. On Hero, only slide/parallax effects can be selected (so page load is not slowed down).
- On products too, changes are autosaved as drafts every ~**2 seconds** and Live Preview refreshes; click **Publish changes** to publish.

### 7.3 What is a SKU?

- A SKU is the **stable code** of an edition. It stays the same regardless of language.
- Quote and license records match by SKU.
- Changing a SKU in the panel updates the same record; however, import treats old/new SKUs as different identities and old quote links can break. Therefore, do not change a SKU that is in use.
- Every edition's SKU is unique. Two editions cannot share the same SKU.

### 7.4 Assigning licenses (admin only)

- **Only an administrator** can create, edit, or delete licenses.
- Editors cannot manage licenses. Customers cannot create licenses either.
- The license key is generated automatically by the system. You do not need to enter it manually.
- Product is derived from the edition; if seats is left blank, the edition's seat count is used as the default. The administrator can enter a different number.
- If subscription end date is left blank, start date + duration (months) is calculated; the administrator can also set the end date explicitly. For a valid license, status must be **Active** (`Aktif`), start date in the past, and end date (if any) in the future. When expired, access closes even if the status label does not change automatically.
- License management can be done via the panel or authorized admin API/MCP. **License deletion is disabled in MCP.**

---

### Sales legal pages

If online sales (payments) will be enabled, three legal pages are required: **distance sales agreement** (`mesafeli satış sözleşmesi`), **pre-information form** (`ön bilgilendirme formu`), and **refund and withdrawal policy** (`iade ve cayma politikası`).

- Pages are records in the **Pages** collection with **Page type = Legal** (`Hukuki`). Which one each record represents is selected from the **Sales legal page type** (`Satış yasal sayfası türü`) field in the sidebar (each type can exist on only one page; the field is visible only on Legal pages).
- Draft texts live under `content/legal/{tr,en}/` and require legal counsel approval. Until the `TASLAK` ("DRAFT") banner at the top and `[BRACKETED]` placeholders are removed, the page remains `noindex`, is excluded from the sitemap, and **payments cannot be enabled**.
- **Company info placeholders populate automatically:** `[ŞİRKET UNVANI]`, `[ADRES]`, `[MERSİS]`, `[VERGİ DAİRESİ/NO]`, `[KEP]`, `[ETBİS NO]`, `[TELEFON]`, `[KVKK İLETİŞİM E-POSTASI]` are not deleted from the text; once filled in Site settings > **Company and contact** (`Şirket ve iletişim`: title, MERSIS, tax office, tax ID, KEP, ETBIS no; address, phone, general email), they appear with real values on the site, in the contract copy, and in checks. If a value is empty, the placeholder remains and the page is treated as draft. Fix other bracketed fields (`[YÜRÜRLÜK TARİHİ]`, `[HUKUK İNCELEMESİ: …]`, etc.) in the text together with legal counsel.
- **Legal approval:** In the page sidebar's **Legal approval** (`Hukukçu onayı`, admin-only, per language) field, enter the approver's name and approval date and save. Approval is bound to the current title and body: if the text changes later, approval is automatically invalidated; update the date to re-approve. Payments cannot open with an unapproved sales page. Editors and API/MCP cannot enter approval.
- When ready, clear the banner and legal placeholders, publish **TR and EN** pages, and approve them. In Site settings > "Sales and payments" readiness checklist, "legal pages" must be 3/3, "counsel-approved versions" 6/6, and "Company details complete" ✓.
- While payments are off (quote-only), these three pages return 404 to visitors and are also excluded from menu/footer links and the sitemap. Draft preview is open to staff.
- Pages are loaded with `pnpm content:import --legal` (type is assigned from filename); this command overwrites both languages' texts and publishes existing records with the same slug, and can overwrite counsel-approved texts with drafts. Inspect first with `--dry-run --legal` on a DB/uploads copy, and run on live only with approved sources.

### Integration settings (admin only)

Admin > **Integration settings** (`Entegrasyon ayarları`): payment provider keys and email (SMTP) account. Editors do not see this page.

- **Top box (read-only):** site URL, payment lock (`PAYMENTS_ENABLED`), Stripe permission, and encryption key are set on the server; they are only displayed here. For each provider/SMTP, the source is shown: **server setting** (`sunucu ayarı`, env var defined; panel value ignored), **panel**, or **none** (`yok`).
- **Secret values (keys, SMTP password):** enter via "Enter/Change" (`Gir/Değiştir`) and click **Save key** (`Anahtarı kaydet`). The value is encrypted and stored and **never shown again**; only "Defined · last 4 chars · updated at" is shown (last characters of SMTP password are not shown). "Clear" (`Temizle`) deletes the record. These fields are independent of the page's "Save" button.
- **Environment:** Test (sandbox) / Live (`Canlı`) is selected for iyzico and Stripe; the selected environment's keys are used, and the API URL comes from the selection. Switching to Live cannot be saved without checking "I confirm live environment" (`Canlı ortamı onaylıyorum`) — real cards will be charged.
- **Stripe** is usable only when permitted on the server (`PAYMENTS_STRIPE_ENABLED=true`); test key must start with `sk_test_`, live with `sk_live_`, and webhook secret with `whsec_`.
- **SMTP:** first enter host, port, TLS, username, sender address/name and **save the page**, then enter the password. If host or username changes, the saved password becomes invalid for security ("Unreadable" / `Okunamıyor`); re-enter it. **Send test email (to me)** sends a message only to your address using the saved settings (1 per minute, max 5 per hour).
- Enabling/disabling the provider on the site and VAT are in Site settings > Inquiries > **Sales and payments** (`Satış ve ödeme`); the readiness checklist shows key source (panel/server/none), SMTP, missing company details, and legal approval.
- If "Encryption key: no" (`Şifreleme anahtarı: hayır`) appears, secrets cannot be saved; ask the server administrator to set `SOFTMARKET_SECRETS_KEY`. If this key changes or is lost, saved values become "Unreadable" and must be re-entered.

## 8. Translation (TR and EN)

### 8.1 Languages

- The site is bilingual: **Turkish** (default) and **English**.
- The content language switcher opens the fields for that language on the same record. The panel's interface language is separate; change the interface language to see labels in Turkish/English.

### 8.2 Which fields are translated?

- **Translated fields** (written separately per language): titles, descriptions, button labels, slug (URL), alt text, text inside blocks.
- **Shared fields** (identical across languages): block type, order, appearance settings, images, SKU, numbers, and quote details without pricing.

### 8.3 Filling both languages together

1. Fill in the Turkish fields.
2. Switch language to **English**.
3. Enter the English equivalents in the same fields.
4. Both languages should be filled. If an English field is left blank, the site may fall back to displaying the Turkish text.

### 8.4 Blocks must be in the same order in both languages

- Because block structure and order are shared, adding, deleting, or reordering a block in one language **affects both languages**. Do the structural operation once; in the other language, only fill in the translated fields.

### 8.5 Slug (URL) translation

- Each page has separate Turkish and English URLs.
- The slug is generated automatically when you enter the title. You can adjust it if needed.
- Two pages in the same language cannot have the same slug.

---

## 9. Troubleshooting

### Changes do not appear

1. **Did you publish?** Drafts (including autosave) do not go to the live site. Click **Publish changes** at the top right.
2. **Did you edit the right language?** A change made on the Turkish site does not appear on the English page. Switch language and make the same change in English.
3. **Are you viewing a draft?** The live site shows only the published version. Preview shows the draft.
4. **Browser cache:** Hard-refresh the page (Mac: `Cmd + Shift + R`, Windows: `Ctrl + F5`).
5. **Still not visible:** Wait a few minutes after publishing. Publishing refreshes the site immediately. Bulk imports can take up to 1 hour. If still missing, notify the technical team.

### Color rejected

- Check the contrast ratios in the message. Make the color slightly darker or lighter.
- See section 5.3 for details.

### Image does not appear

1. **Is it protected?** An image that was protected on initial save cannot be made public later by unchecking the box. Upload a marketing-approved image as a new unprotected record and select it on the page (section 6.4).
2. **Was alt text entered?** Saving fails if alt text is empty.
3. **Did it finish uploading?** If you try to select before upload finishes, the image will not appear in the list. Wait for upload to complete and try again.

### Video does not play

- Is a poster image uploaded? A background video will not save without a poster.
- Is the video MP4 or WebM? Use a short video (recommendation: max 15 seconds; no automatic duration check).
- Is the video public? A protected video will not play on the site.
- On mobile devices or when the visitor has "reduce motion" enabled, the poster is shown. This is expected behavior.

### Error while saving

- **Reserved slug error:** The landing page's slug is reserved by the system. Choose a different slug (section 4.2).
- **Required field error:** Fill in the field marked in red.

### I lost a page

- Deleted pages cannot be reopened. Use **Hide** (`Gizle`) or **Draft** (`Taslak`) before deleting.
- To return to previous versions, check the page's **Versions** (`Sürümler`) tab.

---

## Summary

1. The home page and pages consist of blocks. Add blocks, drag to reorder, and hide if needed.
2. Check draft-supported content in preview and click **Publish changes**. In Menu, Footer, Site settings, and collections without drafts, **Save** applies directly to the site.
3. Images must be unprotected, have alt text, and have complete translations. If color or image rules reject a save, check the message.

> Note: If you edited a product in the editor with bound blocks (composition mode) and the seed is in the legacy layout, `pnpm content:import` preserves the latest draft/autosave layout in both languages, updates other fields, and prints a `layout korundu` ("layout preserved") warning. Import still publishes: a layout that was only in draft is also published. If the seed also contains composition with bound blocks, the seed layout is written and the mandatory "Editions & Request a Quote" rule is enforced. To use the seed layout, convert the seed to a valid composition. `--dry-run` tests the same operation and rolls back.

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
