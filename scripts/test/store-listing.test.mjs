import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load, parse, privacyText, problems, push } from '../store-listing.mjs'

const DOC = readFileSync(new URL('../../docs/store-listing.md', import.meta.url), 'utf8')
const quiet = () => {}

/** App Store Connect as push sees it: the app, its tvOS version in `state`, and what it holds already. */
function store ({ info = [], version = [], category = null, copyright = null, priced = false, state = 'PREPARE_FOR_SUBMISSION' } = {}) {
  const sent = []
  const call = async (path, init = {}) => {
    if (init.method) return sent.push({ method: init.method, path, ...JSON.parse(init.body) })
    if (path.startsWith('/v1/apps?')) return { data: [{ id: 'app', attributes: { bundleId: 'com.julienmalige.tvscores' } }] }
    if (path.includes('/appInfos?')) return { data: [{ type: 'appInfos', id: 'info', attributes: { state }, relationships: { primaryCategory: { data: category && { type: 'appCategories', id: category } } } }] }
    if (path.includes('/appStoreVersions?')) return { data: [{ type: 'appStoreVersions', id: 'v1', attributes: { appVersionState: state, copyright } }] }
    if (path.includes('/appInfoLocalizations')) return { data: info }
    if (path.includes('/appStoreVersionLocalizations')) return { data: version }
    if (path.includes('/manualPrices')) {
      if (!priced) throw new Error(`404 ${path}`)
      return { data: [{}], included: [{ type: 'appPricePoints', attributes: { customerPrice: '0.0' } }] }
    }
    if (path.includes('/appPricePoints')) return { data: [{ id: 'usa-free', attributes: { customerPrice: '0.0' } }, { id: 'usa-1', attributes: { customerPrice: '0.29' } }] }
    throw new Error(`unexpected ${path}`)
  }
  return { call, sent }
}

test('the listing in docs/, with the privacy pages of site/, may go to the store', () => {
  assert.deepEqual(problems(load()), [])
})

test('Apple TV gets the privacy page as text: each heading over its paragraph, links spelt out', () => {
  const html = '<article><h1>Privacy</h1>\n  <p class="updated">Updated</p>\n  <h2>Who</h2>\n  <p>Cloudflare &amp; co, under <a href="https://x.example/p">its policy</a>.\n Ask <a href="mailto:a@b.example">a@b.example</a>.</p></article>'
  assert.equal(privacyText(html), 'Privacy\nUpdated\n\nWho\nCloudflare & co, under its policy (https://x.example/p). Ask a@b.example.')
})

test('each locale sends its own page, and French keeps its non-breaking spaces', () => {
  const listing = load()
  const fr = listing['fr-FR']['Privacy policy text']
  assert.ok(fr.startsWith('Politique de confidentialité\n'))
  assert.ok(fr.includes('\u00a0: support@julienmalige.com'))
  for (const locale of ['en-US', 'pt-BR', 'es-ES']) assert.ok(!/[<>]/.test(listing[locale]['Privacy policy text']), locale)
})

test('a locale without its privacy text is held back', () => {
  const listing = load()
  delete listing['es-ES']['Privacy policy text']
  assert.deepEqual(problems(listing), ['es-ES: no Privacy policy text, made from site/es/privacy.html'])
})

test('the lines every locale shares are read without their backticks', () => {
  const { shared } = parse(DOC)
  assert.equal(shared.Name, 'TV Scores')
  assert.equal(shared['Privacy policy URL'], 'https://tvscores.julienmalige.com/<lang>/privacy')
})

test('a price other than free is refused: push only knows free', () => {
  assert.ok(problems(parse(DOC.replace('- Price: free', '- Price: 0.99'))).some((p) => p.startsWith('Price is')))
})

test('a locale the store lacks is added to the version being prepared, with its own pages', async () => {
  const { call, sent } = store()
  await push(load(), { call, log: quiet })
  const fr = sent.find((s) => s.path === '/v1/appInfoLocalizations' && s.data.attributes.locale === 'fr-FR')
  assert.equal(fr.method, 'POST')
  assert.equal(fr.data.attributes.privacyPolicyUrl, 'https://tvscores.julienmalige.com/fr/privacy')
  assert.deepEqual(fr.data.relationships, { appInfo: { data: { type: 'appInfos', id: 'info' } } })
})

test('only the fields that differ are sent', async () => {
  const listing = load()
  const { call, sent } = store({ info: [{ id: 'en', attributes: { locale: 'en-US', name: 'TV Scores', subtitle: listing['en-US'].Subtitle, privacyPolicyUrl: null, privacyPolicyText: listing['en-US']['Privacy policy text'] } }] })
  await push(listing, { call, log: quiet })
  const en = sent.find((s) => s.path === '/v1/appInfoLocalizations/en')
  assert.equal(en.method, 'PATCH')
  assert.deepEqual(en.data.attributes, { privacyPolicyUrl: 'https://tvscores.julienmalige.com/en/privacy' })
})

test('the category, the copyright and the free price are set once', async () => {
  const fresh = store()
  await push(load(), { call: fresh.call, log: quiet })
  assert.equal(fresh.sent.find((s) => s.path === '/v1/appInfos/info').data.relationships.primaryCategory.data.id, 'SPORTS')
  assert.equal(fresh.sent.find((s) => s.path === '/v1/appStoreVersions/v1').data.attributes.copyright, '2026 Julien Malige')
  assert.equal(fresh.sent.find((s) => s.path === '/v1/appPriceSchedules').included[0].relationships.appPricePoint.data.id, 'usa-free')

  const done = store({ category: 'SPORTS', copyright: '2026 Julien Malige', priced: true })
  await push(load(), { call: done.call, log: quiet })
  assert.deepEqual(done.sent.filter((s) => !s.path.includes('Localizations')), [])
})

test('a dry run says what it would send and sends nothing', async () => {
  const { call, sent } = store()
  const said = []
  await push(load(), { call, dryRun: true, log: (line) => said.push(line) })
  assert.deepEqual(sent, [])
  assert.ok(said.includes('fr-FR: adds name, subtitle, privacyPolicyUrl, privacyPolicyText'))
  assert.ok(said.includes('price: free'))
})

test('a version already sent to review is not touched', async () => {
  const { call, sent } = store({ state: 'WAITING_FOR_REVIEW' })
  await assert.rejects(push(load(), { call, log: quiet }), /no tvOS version open for changes/)
  assert.deepEqual(sent, [])
})
