#!/usr/bin/env node
// Checks the store listing (docs/store-listing.md) against Apple's limits and
// our own rules, and prints each field's length. Zero dependencies.
//
//   node scripts/store-listing.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'store-listing.md')
const NAME = 'TV Scores'
const LOCALES = ['en-US', 'fr-FR', 'pt-BR', 'es-ES']
// App Store Connect's limits, in characters.
const LIMITS = { Subtitle: 30, 'Promotional text': 170, Keywords: 100, Description: 4000 }
// Names that belong to someone else: kept out of the keywords (guideline 2.3.7).
const TRADEMARKS = ['nfl', 'nba', 'f1', 'motogp', 'premier', 'laliga', 'liga', 'serie a', 'bundesliga', 'ligue 1', 'champions', 'europa', 'brasileirão', 'libertadores', 'atp', 'wta', 'espn', 'canal', 'dazn', 'globo', 'apple']

/** { locale: { field: text } } from the "## locale" and "### field" headings. */
export function parse (markdown) {
  const out = {}
  let locale = null
  let field = null
  for (const line of markdown.split('\n')) {
    const l2 = line.match(/^## (\S+)$/)
    const l3 = line.match(/^### (.+)$/)
    if (l2) [locale, field] = [LOCALES.includes(l2[1]) ? l2[1] : null, null]
    else if (l3 && locale) (out[locale] ??= {})[field = l3[1]] = ''
    else if (locale && field) out[locale][field] += `${line}\n`
  }
  for (const fields of Object.values(out)) for (const f of Object.keys(fields)) fields[f] = fields[f].trim()
  return out
}

const words = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Every broken rule, as sentences; empty when the listing may go. */
export function problems (listing) {
  const found = []
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
    const indexed = new Set(words(`${NAME} ${fields.Subtitle ?? ''}`))
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const listing = parse(readFileSync(FILE, 'utf8'))
  for (const locale of LOCALES) {
    const fields = listing[locale] ?? {}
    console.log(`${locale}  ${Object.keys(LIMITS).map((f) => `${f} ${[...(fields[f] ?? '')].length}/${LIMITS[f]}`).join('  ')}`)
  }
  const found = problems(listing)
  for (const p of found) console.error(`✗ ${p}`)
  process.exit(found.length ? 1 : 0)
}
