#!/usr/bin/env node
// Checks the store listing (docs/store-listing.md) against Apple's limits and
// our own rules, and prints each field's length; `push` then sends it to App
// Store Connect, changing only what differs there. Zero dependencies.
//
//   node scripts/store-listing.mjs
//   node scripts/store-listing.mjs push [--dry-run]
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asc } from './asc.mjs'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'store-listing.md')
const BUNDLE_ID = 'com.julienmalige.tvscores'
export const LOCALES = ['en-US', 'fr-FR', 'pt-BR', 'es-ES']
// App Store Connect's limits, in characters.
const LIMITS = { Subtitle: 30, 'Promotional text': 170, Keywords: 100, Description: 4000 }
// The lines every locale shares ("- Name: TV Scores"). <lang> in a value is
// the website's folder for the locale, its first two letters: en, fr, pt, es.
const SHARED = ['Name', 'Category', 'Price', 'Copyright', 'Support URL', 'Marketing URL', 'Privacy policy URL']
// Names that belong to someone else: kept out of the keywords (guideline 2.3.7).
const TRADEMARKS = ['nfl', 'nba', 'f1', 'motogp', 'premier', 'laliga', 'liga', 'serie a', 'bundesliga', 'ligue 1', 'champions', 'europa', 'brasileirão', 'libertadores', 'atp', 'wta', 'espn', 'canal', 'dazn', 'globo', 'apple']
// Where each field goes in App Store Connect: the app's information, or the version's.
const INFO_FIELDS = { Name: 'name', Subtitle: 'subtitle', 'Privacy policy URL': 'privacyPolicyUrl' }
const VERSION_FIELDS = { Description: 'description', Keywords: 'keywords', 'Promotional text': 'promotionalText', 'Marketing URL': 'marketingUrl', 'Support URL': 'supportUrl' }
// The states in which App Store Connect lets a version, and its app information, change.
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY']

/** { locale: { field: text } } from the "## locale" and "### field" headings,
 *  and `shared`: the "- Field: value" lines that hold for every locale. */
export function parse (markdown) {
  const out = { shared: {} }
  let locale = null
  let field = null
  for (const line of markdown.split('\n')) {
    const l2 = line.match(/^## (\S+)$/)
    const l3 = line.match(/^### (.+)$/)
    const common = line.match(/^- ([^:]+): (.+)$/)
    if (l2) [locale, field] = [LOCALES.includes(l2[1]) ? l2[1] : null, null]
    else if (l3 && locale) (out[locale] ??= {})[field = l3[1]] = ''
    else if (locale && field) out[locale][field] += `${line}\n`
    else if (common && SHARED.includes(common[1])) out.shared[common[1]] = common[2].replaceAll('`', '')
  }
  for (const fields of Object.values(out)) for (const f of Object.keys(fields)) fields[f] = fields[f].trim()
  return out
}

const words = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Every broken rule, as sentences; empty when the listing may go. */
export function problems (listing) {
  const found = []
  for (const field of SHARED) if (!listing.shared?.[field]) found.push(`no "${field}" among the lines every locale shares`)
  if (listing.shared?.Price && !/^free\b/i.test(listing.shared.Price)) found.push(`Price is "${listing.shared.Price}": push only knows free`)
  for (const locale of LOCALES) {
    const fields = listing[locale]
    if (!fields) {
      found.push(`${locale}: missing`)
      continue
    }
    for (const [field, limit] of Object.entries(LIMITS)) {
      const text = fields[field]
      if (!text) found.push(`${locale}: no ${field}`)
      else if ([...text].length > limit) found.push(`${locale}: ${field} is ${[...text].length} characters, over ${limit}`)
    }
    const keywords = (fields.Keywords ?? '').split(',')
    if (/,\s|\s,/.test(fields.Keywords ?? '')) found.push(`${locale}: a space beside a comma in Keywords wastes a character`)
    if (new Set(keywords).size !== keywords.length) found.push(`${locale}: a keyword is listed twice`)
    const indexed = new Set(words(`${listing.shared?.Name ?? ''} ${fields.Subtitle ?? ''}`))
    for (const keyword of keywords) {
      if (!keyword.trim()) found.push(`${locale}: an empty keyword`)
      for (const w of words(keyword)) if (indexed.has(w)) found.push(`${locale}: "${w}" is in the name or subtitle already`)
      for (const mark of TRADEMARKS) if (` ${words(keyword).join(' ')} `.includes(` ${mark} `)) found.push(`${locale}: "${keyword}" names a trademark`)
    }
    // French sets a non-breaking space before : ; ? ! so they never open a line.
    if (locale === 'fr-FR') {
      for (const [field, text] of Object.entries(fields)) if (/ [:;?!]/.test(text)) found.push(`fr-FR: ${field} has a plain space before : ; ? or !`)
    }
  }
  return found
}

/** The app, its information and its tvOS version, as long as App Store
 *  Connect still lets them change. `call` is the API (a stand-in in the tests). */
export async function openVersion (call = asc) {
  const app = (await call(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data.find((a) => a.attributes.bundleId === BUNDLE_ID)
  const info = (await call(`/v1/apps/${app.id}/appInfos?include=primaryCategory`)).data.find((i) => EDITABLE.includes(i.attributes.state))
  const version = (await call(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=TV_OS`)).data.find((v) => EDITABLE.includes(v.attributes.appVersionState))
  if (!info || !version) throw new Error('no tvOS version open for changes: add the next version in App Store Connect first')
  return { app, info, version }
}

/** Sends the listing to the tvOS version being prepared: each field that
 *  differs, each locale App Store Connect lacks, the category, the copyright
 *  and the free price. */
export async function push (listing, { call = asc, dryRun = false, log = console.log } = {}) {
  const send = (path, method, data, included) => dryRun ? null : call(path, { method, body: JSON.stringify({ data, included }) })
  const { app, info, version } = await openVersion(call)

  for (const [type, owner, parent, names] of [
    ['appInfoLocalizations', 'appInfo', info, INFO_FIELDS],
    ['appStoreVersionLocalizations', 'appStoreVersion', version, VERSION_FIELDS]
  ]) {
    const { data: present } = await call(`/v1/${parent.type}/${parent.id}/${type}?limit=50`)
    for (const locale of LOCALES) {
      const fields = { ...listing.shared, ...listing[locale] }
      const want = Object.fromEntries(Object.entries(names).map(([field, key]) => [key, fields[field].replaceAll('<lang>', locale.slice(0, 2))]))
      const mine = present.find((l) => l.attributes.locale === locale)
      const differ = Object.keys(want).filter((key) => mine?.attributes[key] !== want[key])
      if (!differ.length) continue
      log(`${locale}: ${mine ? 'changes' : 'adds'} ${differ.join(', ')}`)
      const attributes = Object.fromEntries(differ.map((key) => [key, want[key]]))
      await (mine
        ? send(`/v1/${type}/${mine.id}`, 'PATCH', { type, id: mine.id, attributes })
        : send(`/v1/${type}`, 'POST', { type, attributes: { locale, ...attributes }, relationships: { [owner]: { data: { type: parent.type, id: parent.id } } } }))
    }
  }

  // "Sports" is App Store Connect's SPORTS.
  const category = listing.shared.Category.toUpperCase().replaceAll(' ', '_')
  if (info.relationships.primaryCategory.data?.id !== category) {
    log(`category: ${category}`)
    await send(`/v1/appInfos/${info.id}`, 'PATCH', { type: 'appInfos', id: info.id, relationships: { primaryCategory: { data: { type: 'appCategories', id: category } } } })
  }
  if (version.attributes.copyright !== listing.shared.Copyright) {
    log(`copyright: ${listing.shared.Copyright}`)
    await send(`/v1/appStoreVersions/${version.id}`, 'PATCH', { type: 'appStoreVersions', id: version.id, attributes: { copyright: listing.shared.Copyright } })
  }

  // An app with no price yet answers 404 here rather than an empty list.
  const price = await call(`/v1/appPriceSchedules/${app.id}/manualPrices?include=appPricePoint`)
    .catch((err) => { if (err.message.startsWith('404')) return null; throw err })
  if (!price?.included?.some((p) => p.type === 'appPricePoints' && Number(p.attributes.customerPrice) === 0)) {
    log('price: free')
    const { data: points } = await call(`/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=10`)
    const free = points.find((p) => Number(p.attributes.customerPrice) === 0)
    // `${free}` names the price created along with the schedule, as Apple's own example does.
    await send('/v1/appPriceSchedules', 'POST', {
      type: 'appPriceSchedules',
      relationships: {
        app: { data: { type: 'apps', id: app.id } },
        baseTerritory: { data: { type: 'territories', id: 'USA' } },
        manualPrices: { data: [{ type: 'appPrices', id: '${free}' }] }
      }
    }, [{ type: 'appPrices', id: '${free}', attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } } }])
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const listing = parse(readFileSync(FILE, 'utf8'))
  for (const locale of LOCALES) {
    const fields = listing[locale] ?? {}
    console.log(`${locale}  ${Object.keys(LIMITS).map((f) => `${f} ${[...(fields[f] ?? '')].length}/${LIMITS[f]}`).join('  ')}`)
  }
  const found = problems(listing)
  for (const p of found) console.error(`✗ ${p}`)
  if (found.length) process.exit(1)
  if (process.argv[2] === 'push') {
    await push(listing, { dryRun: process.argv.includes('--dry-run') }).catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
  }
}
