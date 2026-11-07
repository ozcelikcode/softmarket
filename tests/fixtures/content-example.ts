const example = {
  version: 1,
  'product-families': [{ tr: { title: 'Örnek Aile', slug: 'ornek-aile' }, en: { title: 'Example Family', slug: 'example-family' } }],
  products: [{ tr: { title: 'Örnek Ürün', slug: 'ornek-urun', family: 'ornek-aile', layout: [{ blockType: 'hero', heading: 'Örnek Ürün' }] }, en: { title: 'Example Product', slug: 'example-product', family: 'ornek-aile', layout: [{ blockType: 'hero', heading: 'Example Product' }] } }],
  editions: [{ tr: { title: 'Örnek Sürüm', sku: 'EXAMPLE-EDITION', product: 'ornek-urun', licenseType: 'perpetual', seats: 1 }, en: { title: 'Example Edition', sku: 'EXAMPLE-EDITION', product: 'ornek-urun', licenseType: 'perpetual', seats: 1 } }],
}
export default example
