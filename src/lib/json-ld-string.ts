// Dependency-free so the client JsonLd island does not pull lib/seo (routing, paths) into the browser bundle.
export const jsonLdString = (data: unknown): string =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')
