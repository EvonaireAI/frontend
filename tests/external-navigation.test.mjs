import assert from 'node:assert/strict'
import { test } from 'node:test'

const { isAllowedExternalUrl } = await import('../lib/external-navigation.ts')

const ALLOWED = [
  'https://checkout.stripe.com/c/pay/cs_test_abc123',
  'https://checkout.stripe.com/pay/cs_live_xyz#fidkdWxOYHwnPyd1blpxYHZxWjA0',
  'https://stripe.com',
  'https://connect.stripe.com/setup/e/acct_123/XYZ',
  'https://dashboard.stripe.com/express/acct_123',
  'https://billing.stripe.com/p/session/test',
]

const DENIED = [
  // Script-capable schemes — the whole point of the guard.
  'javascript:alert(document.domain)',
  'javascript://checkout.stripe.com/%0aalert(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD4=',
  'vbscript:msgbox(1)',
  'blob:https://checkout.stripe.com/uuid',
  'file:///etc/passwd',
  // Downgrade: stripe host over plain http.
  'http://checkout.stripe.com/c/pay/cs_test_abc',
  // Stripe lookalikes that are not stripe hosts.
  'https://stripe.com.evil.com/phish',
  'https://evil.com/stripe.com',
  'https://checkout-stripe.com/c/pay/cs_test_abc',
  'https://notstripe.com',
  'https://stripexcom',
  'https://strike.com',
  // Userinfo tricks — the real host sits after the @.
  'https://checkout.stripe.com@evil.com/',
  'https://user:pass@evil.com/',
  // Malformed or empty.
  'not a url',
  'https://',
  '',
  '   ',
  '\\\\evil.com\\share',
  '//evil.com/path',
  // Non-string values.
  null,
  undefined,
  42,
  { url: 'https://checkout.stripe.com' },
]

test('stripe-hosted https URLs are allowed', () => {
  for (const url of ALLOWED) {
    assert.equal(isAllowedExternalUrl(url), true, url)
  }
})

test('non-stripe, non-https, malformed, and lookalike URLs are denied', () => {
  for (const url of DENIED) {
    assert.equal(isAllowedExternalUrl(url), false, String(url))
  }
})

test('subdomain depth and casing do not matter', () => {
  assert.equal(isAllowedExternalUrl('https://a.b.c.stripe.com/x'), true)
  assert.equal(isAllowedExternalUrl('HTTPS://CHECKOUT.STRIPE.COM/c/pay/x'), true)
})

test('IDN homoglyphs of the stripe host are denied', () => {
  // xn-- punycode never matches the stripe.com regex.
  assert.equal(isAllowedExternalUrl('https://xn--stripe-9ua.com/'), false)
})
