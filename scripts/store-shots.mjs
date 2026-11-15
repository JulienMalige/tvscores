#!/usr/bin/env node
// Uploads the App Store's screenshots, as the store-shots workflow leaves
// them, to the version being prepared: the Apple TV's from
// <folder>/<locale>/<n>-<name>.png, the iPhone's and the iPad's from
// <folder>/<locale>/iphone/ and ipad/ (--platform IOS). Each set is replaced,
// in file name order, unless App Store Connect holds those very files
// already. Zero dependencies.
//
//   gh run download <run id> -n store-shots -D <folder>
//   node scripts/store-shots.mjs <folder> [--platform TV_OS|IOS] [--dry-run]
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { asc } from './asc.mjs'
import { LOCALES, openVersion } from './store-listing.mjs'

// App Store Connect's names for each platform's sets, and where their files
// are: the Apple TV's 3840x2160; the 6.9-inch iPhone's 1320x2868, which
// Apple files under 6.7 (forum thread 763908); the 13-inch iPad's 2064x2752.
export const SETS = {
  TV_OS: [{ display: 'APP_APPLE_TV', sub: '' }],
  IOS: [{ display: 'APP_IPHONE_67', sub: 'iphone' }, { display: 'APP_IPAD_PRO_3GEN_129', sub: 'ipad' }]
}

const json = (method, data) => ({ method, body: JSON.stringify({ data }) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Replaces each locale's Apple TV screenshots with the folder's, then waits
 *  until Apple has accepted every picture, those of an earlier run included.
 *  `call` is the API and `put` the upload: stand-ins in the tests. */
export async function upload (folder, { call = asc, put = fetch, dryRun = false, log = console.log, pause = wait, platform = 'TV_OS' } = {}) {
  const { version } = await openVersion(call, platform)
  const { data: localizations } = await call(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)
  const waiting = []
  for (const locale of LOCALES) for (const { display: DISPLAY, sub } of SETS[platform]) {
    const label = sub ? `${locale} ${sub}` : locale
    const shots = readdirSync(join(folder, locale, sub)).filter((name) => name.endsWith('.png')).sort().map((name) => {
      const bytes = readFileSync(join(folder, locale, sub, name))
      return { name, bytes, md5: createHash('md5').update(bytes).digest('hex') }
    })
    const localization = localizations.find((l) => l.attributes.locale === locale)
    if (!localization) throw new Error(`${locale} is not in App Store Connect yet: run store-listing.mjs push first`)
    const { data: sets } = await call(`/v1/appStoreVersionLocalizations/${localization.id}/appScreenshotSets`)
    let set = sets.find((s) => s.attributes.screenshotDisplayType === DISPLAY)
    const present = set ? (await call(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data : []
    // A picture Apple is still looking at gives no checksum yet (2026-10-27):
    // its name and size stand in for it.
    const held = present.length === shots.length && present.every(({ attributes: a }, i) => a.sourceFileChecksum
      ? a.sourceFileChecksum === shots[i].md5
      : a.fileName === shots[i].name && a.fileSize === shots[i].bytes.length)
    if (held) {
      if (present.some((s) => s.attributes.assetDeliveryState?.state !== 'COMPLETE')) waiting.push({ locale: label, set: set.id })
      continue
    }
    log(`${label}: ${shots.length} screenshots${present.length ? `, in place of ${present.length}` : ''}`)
    if (dryRun) continue
    set ??= (await call('/v1/appScreenshotSets', json('POST', {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: DISPLAY },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: localization.id } } }
    }))).data
    // The old ones go first: a set holds ten at most. A run that fails
    // halfway leaves the set short until it is run again.
    for (const old of present) await call(`/v1/appScreenshots/${old.id}`, { method: 'DELETE' })
    for (const shot of shots) {
      // A place is reserved, the parts go where Apple says, then the checksum closes it.
      const { data: reserved } = await call('/v1/appScreenshots', json('POST', {
        type: 'appScreenshots',
        attributes: { fileName: shot.name, fileSize: shot.bytes.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } }
      }))
      for (const part of reserved.attributes.uploadOperations) {
        const headers = Object.fromEntries(part.requestHeaders.map((h) => [h.name, h.value]))
        const res = await put(part.url, { method: part.method, headers, body: shot.bytes.subarray(part.offset, part.offset + part.length) })
        if (!res.ok) throw new Error(`${label} ${shot.name}: the upload answered ${res.status}`)
      }
      await call(`/v1/appScreenshots/${reserved.id}`, json('PATCH', { type: 'appScreenshots', id: reserved.id, attributes: { uploaded: true, sourceFileChecksum: shot.md5 } }))
    }
    waiting.push({ locale: label, set: set.id })
  }
  // Apple looks at each picture once it is in, minutes later at times
  // (2026-10-27): a wrong size fails here, not above.
  for (let round = 0, left = waiting; left.length; round++) {
    if (round === 30) throw new Error(`still being looked at after 15 minutes: ${left.map((w) => w.locale).join(', ')}; run this again to go on waiting`)
    if (round) await pause(30000)
    const next = []
    for (const w of left) {
      const { data } = await call(`/v1/appScreenshotSets/${w.set}/appScreenshots`)
      const failed = data.find((s) => s.attributes.assetDeliveryState?.state === 'FAILED')
      if (failed) throw new Error(`${w.locale} ${failed.attributes.fileName}: ${failed.attributes.assetDeliveryState.errors?.map((e) => e.description).join('; ') || 'refused'}`)
      if (data.some((s) => s.attributes.assetDeliveryState?.state !== 'COMPLETE')) next.push(w)
    }
    left = next
  }
  if (waiting.length) log(`${waiting.map((w) => w.locale).join(', ')}: every picture accepted`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [folder] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  if (!folder) {
    console.error('usage: store-shots.mjs <folder> [--platform TV_OS|IOS] [--dry-run]')
    process.exit(2)
  }
  const at = process.argv.indexOf('--platform')
  await upload(folder, { dryRun: process.argv.includes('--dry-run'), platform: at > 0 ? process.argv[at + 1] : 'TV_OS' }).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
