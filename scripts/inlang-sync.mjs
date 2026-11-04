#!/usr/bin/env node
// Bridges Lingui catalogs (src/locales/*.json: id -> {message, translation, ...})
// and the flat ICU files inlang/Fink edit (inlang-locales/*.json: id -> ICU string),
// which @inlang/plugin-icu1 parses into plural/select variants.
//
//   node scripts/inlang-sync.mjs export   # lingui -> inlang   (after `lingui extract`)
//   node scripts/inlang-sync.mjs import   # inlang -> lingui   (after pulling Fink edits)
import fs from 'node:fs'

const LINGUI = 'src/locales'
const INLANG = 'inlang-locales'
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {})
const write = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
const locales = fs.readdirSync(LINGUI).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
const source = read(`${LINGUI}/en.json`)
fs.mkdirSync(INLANG, { recursive: true })

const mode = process.argv[2]
if (!['export', 'import'].includes(mode)) {
  console.error('usage: inlang-sync.mjs export|import')
  process.exit(1)
}
for (const locale of locales) {
  const lingui = read(`${LINGUI}/${locale}.json`)
  const inlang = read(`${INLANG}/${locale}.json`)
  const out = {}
  for (const [id, entry] of Object.entries(source)) {
    if (mode === 'export') {
      // Keep edits already in inlang; fall back to Lingui; en always mirrors source text.
      out[id] = locale === 'en' ? entry.message : inlang[id] || lingui[id]?.translation || ''
    } else {
      lingui[id] = { ...(lingui[id] ?? entry), translation: inlang[id] ?? '' }
    }
  }
  if (mode === 'export') write(`${INLANG}/${locale}.json`, out)
  else write(`${LINGUI}/${locale}.json`, lingui)
}
console.log(`${mode}ed ${locales.join(', ')}`)
