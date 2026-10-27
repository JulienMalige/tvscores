import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { upload } from '../store-shots.mjs'

const LOCALES = ['en-US', 'fr-FR', 'pt-BR', 'es-ES']
const md5 = (text) => createHash('md5').update(text).digest('hex')
const quiet = () => {}
// What App Store Connect holds when it holds this folder's pictures already.
const same = () => Object.fromEntries(LOCALES.map((l) => [l, [md5(`${l} 1-today.png`), md5(`${l} 2-watch.png`)]]))

/** The workflow's artifact in small: two pictures per locale, whose bytes are their names. */
function folder () {
  const root = mkdtempSync(join(tmpdir(), 'store-shots-'))
  for (const locale of LOCALES) {
    mkdirSync(join(root, locale))
    for (const name of ['2-watch.png', '1-today.png']) writeFileSync(join(root, locale, name), `${locale} ${name}`)
  }
  return root
}

/** App Store Connect as the upload sees it: per locale, the checksums of the
 *  Apple TV pictures it `held` before; a new picture is then given `verdict`. */
function connect (held = {}, verdict = { state: 'COMPLETE' }) {
  const calls = []
  const uploads = []
  const sets = Object.fromEntries(Object.entries(held).map(([locale, sums]) => [locale, sums.map((sum, i) => (
    { id: `${locale}/old-${i}`, attributes: { sourceFileChecksum: sum, assetDeliveryState: { state: 'COMPLETE' } } }))]))
  const call = async (path, init = {}) => {
    const body = init.body && JSON.parse(init.body).data
    calls.push({ method: init.method ?? 'GET', path, body })
    if (path.startsWith('/v1/apps?')) return { data: [{ id: 'app', attributes: { bundleId: 'com.julienmalige.tvscores' } }] }
    if (path.includes('/appInfos?')) return { data: [{ id: 'info', attributes: { state: 'PREPARE_FOR_SUBMISSION' } }] }
    if (path.includes('/appStoreVersions?')) return { data: [{ id: 'v1', attributes: { appVersionState: 'PREPARE_FOR_SUBMISSION' } }] }
    if (path.endsWith('/appStoreVersionLocalizations?limit=50')) return { data: LOCALES.map((locale) => ({ id: locale, attributes: { locale } })) }
    const listed = path.match(/^\/v1\/appStoreVersionLocalizations\/(.+)\/appScreenshotSets$/)
    if (listed) return { data: sets[listed[1]] ? [{ id: `set-${listed[1]}`, attributes: { screenshotDisplayType: 'APP_APPLE_TV' } }] : [] }
    const inSet = path.match(/^\/v1\/appScreenshotSets\/set-(.+)\/appScreenshots$/)
    if (inSet) return { data: sets[inSet[1]] }
    if (path === '/v1/appScreenshotSets') {
      const locale = body.relationships.appStoreVersionLocalization.data.id
      sets[locale] = []
      return { data: { id: `set-${locale}` } }
    }
    if (path === '/v1/appScreenshots') {
      const locale = body.relationships.appScreenshotSet.data.id.slice('set-'.length)
      const id = `${locale}/${body.attributes.fileName}`
      sets[locale].push({ id, attributes: { fileName: body.attributes.fileName, assetDeliveryState: verdict } })
      const parts = [
        { method: 'PUT', url: 'https://upload.example/1', offset: 0, length: 3, requestHeaders: [{ name: 'Content-Type', value: 'image/png' }] },
        { method: 'PUT', url: 'https://upload.example/2', offset: 3, length: body.attributes.fileSize - 3, requestHeaders: [] }
      ]
      return { data: { id, attributes: { uploadOperations: parts } } }
    }
    if (init.method === 'DELETE') {
      const id = path.slice('/v1/appScreenshots/'.length)
      for (const locale of Object.keys(sets)) sets[locale] = sets[locale].filter((s) => s.id !== id)
    }
    return null
  }
  const put = async (url, init) => {
    uploads.push({ url, headers: init.headers, body: Buffer.from(init.body).toString() })
    return { ok: true, status: 200 }
  }
  return { call, put, calls, uploads }
}

test('a locale with no Apple TV set gets one, its pictures sent in file name order', async () => {
  const store = connect()
  await upload(folder(), { call: store.call, put: store.put, log: quiet })
  const set = store.calls.find((c) => c.path === '/v1/appScreenshotSets' && c.body.relationships.appStoreVersionLocalization.data.id === 'fr-FR')
  assert.equal(set.body.attributes.screenshotDisplayType, 'APP_APPLE_TV')
  const fr = store.calls.filter((c) => c.path === '/v1/appScreenshots' && c.body.relationships.appScreenshotSet.data.id === 'set-fr-FR')
  assert.deepEqual(fr.map((c) => c.body.attributes.fileName), ['1-today.png', '2-watch.png'])
})

test('a picture goes up in the parts Apple asks for, then is closed with its checksum', async () => {
  const store = connect()
  await upload(folder(), { call: store.call, put: store.put, log: quiet })
  assert.deepEqual(store.uploads.slice(0, 2).map((u) => u.body), ['en-', 'US 1-today.png'])
  assert.equal(store.uploads[0].headers['Content-Type'], 'image/png')
  const closed = store.calls.find((c) => c.method === 'PATCH')
  assert.deepEqual(closed.body.attributes, { uploaded: true, sourceFileChecksum: md5('en-US 1-today.png') })
})

test('pictures App Store Connect holds already are not sent again', async () => {
  const store = connect(same())
  await upload(folder(), { call: store.call, put: store.put, log: quiet })
  assert.deepEqual(store.calls.filter((c) => c.method !== 'GET'), [])
  assert.deepEqual(store.uploads, [])
})

test('older pictures go before the new ones come in, in the set already there', async () => {
  const store = connect({ ...same(), 'es-ES': ['an older picture'] })
  await upload(folder(), { call: store.call, put: store.put, log: quiet })
  const changes = store.calls.filter((c) => c.method !== 'GET')
  assert.deepEqual(changes[0], { method: 'DELETE', path: '/v1/appScreenshots/es-ES/old-0', body: undefined })
  assert.ok(!changes.slice(1).some((c) => c.method === 'DELETE'), 'and only then the new ones')
  assert.ok(!changes.some((c) => c.path === '/v1/appScreenshotSets'), 'into the set it has')
  assert.equal(store.uploads.length, 4, 'two pictures in two parts, for Spain alone')
})

test("a picture Apple refuses stops the run with Apple's reason", async () => {
  const store = connect({}, { state: 'FAILED', errors: [{ description: 'wrong size' }] })
  await assert.rejects(upload(folder(), { call: store.call, put: store.put, log: quiet }), /en-US 1-today\.png: wrong size/)
})

test('a run that finds its pictures still being looked at waits for them, sending nothing', async () => {
  const store = connect(same())
  let looking = 2
  // Until Apple is done, a picture has a name and a size but no checksum.
  const call = async (path, init) => {
    const answer = await store.call(path, init)
    if (path === '/v1/appScreenshotSets/set-fr-FR/appScreenshots' && looking-- > 0) {
      const names = ['1-today.png', '2-watch.png']
      return { data: answer.data.map((s, i) => ({ ...s, attributes: { fileName: names[i], fileSize: `fr-FR ${names[i]}`.length, sourceFileChecksum: null, assetDeliveryState: { state: 'UPLOAD_COMPLETE' } } })) }
    }
    return answer
  }
  const pauses = []
  await upload(folder(), { call, put: store.put, log: quiet, pause: async (ms) => pauses.push(ms) })
  assert.equal(pauses.length, 1, 'once, for the look still going on')
  assert.deepEqual(store.calls.filter((c) => c.method !== 'GET'), [])
})
