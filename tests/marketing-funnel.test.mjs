import assert from 'node:assert/strict'
import { test } from 'node:test'

const { buildUtmUrl, trackFunnelEvent } = await import('../lib/funnel.ts')

const sessionMap = new Map()
globalThis.sessionStorage = {
  getItem: (key) => (sessionMap.has(key) ? sessionMap.get(key) : null),
  setItem: (key, value) => void sessionMap.set(key, String(value)),
  removeItem: (key) => void sessionMap.delete(key),
  clear: () => sessionMap.clear(),
}

let posted = []
globalThis.fetch = async (url, init = {}) => {
  posted.push({ url: String(url), init })
  return new Response(JSON.stringify({ id: 1 }), { status: 201 })
}

function setBrowserLocation(pathname, search = '', referrer = '') {
  globalThis.window = {
    location: { pathname, search, origin: 'https://evonaire.ai' },
  }
  globalThis.document = { referrer }
}

test('buildUtmUrl normalizes UTM tags to lowercase and preserves base URL', () => {
  const url = buildUtmUrl('https://evonaire.ai', {
    utm_source: ' Instagram ',
    utm_medium: 'Social ',
    utm_campaign: 'Launch_Post_1',
  })
  assert.equal(
    url,
    'https://evonaire.ai/?utm_source=instagram&utm_medium=social&utm_campaign=launch_post_1',
  )
})

test('trackFunnelEvent reuses session key and upgrades blank initial attribution when UTM link is visited', () => {
  sessionMap.clear()
  posted = []

  // First visit lands on `/` with no UTM params.
  setBrowserLocation('/', '', '')
  trackFunnelEvent('page_view')
  assert.equal(posted.length, 1)
  const firstBody = JSON.parse(posted[0].init.body)
  assert.equal(firstBody.event_type, 'page_view')
  assert.equal(firstBody.utm_source, '')
  assert.ok(firstBody.session_key.length >= 8)

  // Visitor then clicks a tagged social link in the same tab.
  setBrowserLocation('/', '?utm_source=Instagram&utm_medium=Social&utm_campaign=Yoga_Group', 'https://instagram.com')
  trackFunnelEvent('signup_click')
  assert.equal(posted.length, 2)
  const secondBody = JSON.parse(posted[1].init.body)
  assert.equal(secondBody.session_key, firstBody.session_key)
  assert.equal(secondBody.utm_source, 'instagram')
  assert.equal(secondBody.utm_medium, 'social')
  assert.equal(secondBody.utm_campaign, 'yoga_group')

  // Subsequent register form view without query params keeps the first-touch UTM tags.
  setBrowserLocation('/auth/register', '', '')
  trackFunnelEvent('signup_view')
  assert.equal(posted.length, 3)
  const thirdBody = JSON.parse(posted[2].init.body)
  assert.equal(thirdBody.session_key, firstBody.session_key)
  assert.equal(thirdBody.utm_source, 'instagram')
  assert.equal(thirdBody.utm_campaign, 'yoga_group')
})
