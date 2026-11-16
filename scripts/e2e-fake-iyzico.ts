// Fake iyzico Checkout Form host for the ISOLATED e2e only (port 3500, loopback). Refuses to start outside the isolated
// harness. No real provider is contacted; signatures are computed with the same shared secret the app is given.
import { createServer } from 'node:http'

import { assertIsolatedE2E } from '../src/lib/e2e-isolation'
import { iyzicoResponseSignature, iyzicoSignaturePrice } from '../src/lib/payments/signature/iyzico'

assertIsolatedE2E()
const PORT = 3500
const SECRET = process.env.IYZICO_SECRET_KEY ?? ''
if (!SECRET) throw new Error('IYZICO_SECRET_KEY is required')

type Session = { token: string; conversationId: string; price: string; currency: string; callbackUrl: string; status: 'INIT' | 'SUCCESS' | 'FAILURE' }
const sessions = new Map<string, Session>()
let seq = 0

const readBody = (req: import('node:http').IncomingMessage) =>
  new Promise<string>((resolve) => { const chunks: Buffer[] = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))) })
const html = (res: import('node:http').ServerResponse, body: string, status = 200) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body) }
const json = (res: import('node:http').ServerResponse, value: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  if (req.method === 'POST' && url.pathname === '/payment/iyzipos/checkoutform/initialize/auth/ecom') {
    const body = JSON.parse(await readBody(req)) as Record<string, string>
    const token = `e2etok${String(++seq).padStart(6, '0')}Zx${Math.random().toString(36).slice(2, 10)}`
    sessions.set(token, { token, conversationId: body.conversationId!, price: body.price!, currency: body.currency!, callbackUrl: body.callbackUrl!, status: 'INIT' })
    return json(res, { status: 'success', conversationId: body.conversationId, token, paymentPageUrl: `http://127.0.0.1:${PORT}/pay?token=${token}`, tokenExpireTime: 1800, signature: iyzicoResponseSignature(SECRET, [body.conversationId!, token]) })
  }
  if (req.method === 'POST' && url.pathname === '/payment/iyzipos/checkoutform/auth/ecom/detail') {
    const { token } = JSON.parse(await readBody(req)) as { token: string }
    const s = sessions.get(token)
    if (!s) return json(res, { status: 'failure', errorCode: '5004' })
    const paymentId = `9${String(seq).padStart(7, '0')}`
    const price = iyzicoSignaturePrice(s.price)
    const paymentStatus = s.status === 'INIT' ? 'INIT_THREEDS' : s.status
    return json(res, {
      status: 'success', paymentStatus, paymentId, currency: s.currency, basketId: s.conversationId, conversationId: s.conversationId, paidPrice: s.price, price: s.price, token, fraudStatus: 1, installment: 1,
      signature: iyzicoResponseSignature(SECRET, [paymentStatus, paymentId, s.currency, s.conversationId, s.conversationId, price, price, token]),
    })
  }
  if (req.method === 'GET' && url.pathname === '/pay') {
    const s = sessions.get(url.searchParams.get('token') ?? '')
    if (!s) return html(res, '<h1>Unknown session</h1>', 404)
    return html(res, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fake iyzico</title><body><h1>Fake iyzico payment page</h1>
<p data-testid="fake-amount">${esc(s.price)} ${esc(s.currency)}</p><p data-testid="fake-order">${esc(s.conversationId)}</p>
<form method="post" action="/pay/complete"><input type="hidden" name="token" value="${esc(s.token)}">
<button name="result" value="success">Pay now</button> <button name="result" value="failure">Decline</button></form></body></html>`)
  }
  if (req.method === 'POST' && url.pathname === '/pay/complete') {
    const params = new URLSearchParams(await readBody(req))
    const s = sessions.get(params.get('token') ?? '')
    if (!s) return html(res, '<h1>Unknown session</h1>', 404)
    s.status = params.get('result') === 'success' ? 'SUCCESS' : 'FAILURE'
    // Like iyzico: the BROWSER posts the token to the merchant's callback URL (cross-site POST).
    return html(res, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Redirecting</title><body><form id="f" method="post" action="${esc(s.callbackUrl)}"><input type="hidden" name="token" value="${esc(s.token)}"><button>Continue to the shop</button></form><script>document.getElementById('f').submit()</script></body></html>`)
  }
  res.writeHead(404).end()
}).listen(PORT, '127.0.0.1')
