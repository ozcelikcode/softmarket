// Admin block picker placeholders (480x300 webp) -> public/admin/blocks/<slug>.webp.
// Wireframes only; F10 replaces them with real screenshots of the block gallery page.
// Usage: node scripts/admin-block-placeholders.mjs
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const out = join(process.cwd(), 'public/admin/blocks')
mkdirSync(out, { recursive: true })

const dark = { bg: '#0b0d10', surface: '#13161b', line: '#262b33', text: '#e7eaee', muted: '#8a93a0' }
const light = { bg: '#f7f8fa', surface: '#ffffff', line: '#e3e6ea', text: '#11151a', muted: '#6b7480' }
const accent = '#4c7dff'
const bar = (x, y, w, h, fill, r = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
const box = (x, y, w, h, c, r = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c.surface}" stroke="${c.line}"/>`

const blocks = {
  hero: [dark, 'Giriş (Hero)', (c) => `<radialGradient id="g" cx="30%" cy="20%" r="70%"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient><rect width="480" height="300" fill="url(#g)"/>${bar(32, 70, 60, 6, accent)}${bar(32, 88, 190, 18, c.text)}${bar(32, 112, 150, 18, c.text)}${bar(32, 142, 170, 6, c.muted)}${bar(32, 154, 140, 6, c.muted)}${bar(32, 178, 70, 22, accent, 6)}${bar(110, 178, 70, 22, c.line, 6)}${box(260, 60, 190, 150, c)}`],
  featureGrid: [light, 'Özellik ızgarası', (c) => `${bar(32, 40, 180, 14, c.text)}${[0, 1, 2].map((i) => `${box(32 + i * 142, 76, 130, 130, c)}${bar(48 + i * 142, 94, 22, 22, accent, 5)}${bar(48 + i * 142, 130, 90, 8, c.text)}${bar(48 + i * 142, 146, 96, 5, c.muted)}${bar(48 + i * 142, 156, 80, 5, c.muted)}`).join('')}`],
  mediaText: [light, 'Medya + metin', (c) => `${box(32, 50, 200, 160, c)}<path d="M52 190 L102 130 L142 170 L172 145 L212 190Z" fill="${c.line}"/>${bar(260, 80, 170, 14, c.text)}${bar(260, 108, 180, 6, c.muted)}${bar(260, 120, 160, 6, c.muted)}${bar(260, 132, 170, 6, c.muted)}${bar(260, 156, 80, 22, accent, 6)}`],
  specTable: [light, 'Teknik tablo', (c) => `${bar(32, 36, 150, 14, c.text)}${box(32, 64, 416, 150, c, 6)}${[0, 1, 2, 3, 4].map((i) => `${bar(48, 80 + i * 26, 110, 7, c.muted)}${bar(250, 80 + i * 26, 150, 7, c.text)}${i < 4 ? `<line x1="32" x2="448" y1="${98 + i * 26}" y2="${98 + i * 26}" stroke="${c.line}"/>` : ''}`).join('')}`],
  stats: [dark, 'Rakamlar', (c) => `${bar(32, 40, 160, 14, c.text)}${[0, 1, 2, 3].map((i) => `${box(32 + i * 106, 76, 98, 120, c, 4)}${bar(46 + i * 106, 96, 56, 24, c.text)}${bar(46 + i * 106, 134, 60, 7, c.text)}${bar(46 + i * 106, 150, 50, 5, c.muted)}`).join('')}`],
  logoWall: [dark, 'Logo duvarı', (c) => `${bar(170, 60, 140, 7, c.muted)}${[0, 1, 2, 3, 4].map((i) => bar(40 + i * 84, 100, 64, 22, c.line, 4)).join('')}${[0, 1, 2, 3].map((i) => bar(82 + i * 84, 140, 64, 22, c.line, 4)).join('')}`],
  cta: [dark, 'Çağrı bandı', (c) => `<radialGradient id="g" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${accent}" stop-opacity=".3"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient><rect width="480" height="300" fill="url(#g)"/>${bar(110, 80, 260, 20, c.text)}${bar(150, 116, 180, 7, c.muted)}${bar(170, 130, 140, 7, c.muted)}${bar(160, 158, 76, 24, accent, 6)}${bar(244, 158, 76, 24, c.line, 6)}`],
  faq: [light, 'SSS', (c) => `${bar(100, 40, 130, 14, c.text)}${[0, 1, 2, 3].map((i) => `${bar(100, 80 + i * 34, 220, 8, c.text)}<path d="M372 ${80 + i * 34} l6 6 l6 -6" stroke="${c.muted}" fill="none" stroke-width="2"/><line x1="100" x2="384" y1="${100 + i * 34}" y2="${100 + i * 34}" stroke="${c.line}"/>`).join('')}`],
  richText: [light, 'Zengin metin', (c) => `${bar(90, 40, 200, 16, c.text)}${[0, 1, 2, 3, 4, 5].map((i) => bar(90, 76 + i * 14, i === 5 ? 180 : 300, 6, c.muted)).join('')}${bar(90, 172, 150, 11, c.text)}${[0, 1].map((i) => bar(90, 194 + i * 14, 290, 6, c.muted)).join('')}`],
  videoEmbed: [dark, 'Video', (c) => `${bar(90, 30, 150, 12, c.text)}${box(90, 54, 300, 170, c, 8)}<circle cx="240" cy="139" r="24" fill="${accent}"/><path d="M233 127 L252 139 L233 151Z" fill="#fff"/>`],
}

for (const [slug, [c, label, draw]] of Object.entries(blocks)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" fill="${c.bg}"/>${draw(c)}<rect x="0" y="258" width="480" height="42" fill="${c.surface}" stroke="${c.line}"/><text x="24" y="285" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="${c.text}">${label}</text></svg>`
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(join(out, `${slug}.webp`))
}
console.log('wrote', Object.keys(blocks).length, 'placeholders to', out)
