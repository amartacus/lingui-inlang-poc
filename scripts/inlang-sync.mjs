#!/usr/bin/env node
// Bridges Lingui catalogs (src/locales/*.json, keyed by hashed id) and the
// flat i18next-style files inlang/Fink edits (inlang-locales/*.json, keyed by
// the human-readable source message).
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
for (const locale of locales) {
  const lingui = read(`${LINGUI}/${locale}.json`)
  const inlang = read(`${INLANG}/${locale}.json`)
  if (mode === 'export') {
    // Keep existing translations from inlang; add new messages; drop obsolete ones.
    const out = {}
    for (const { message } of Object.values(source)) {
      const fromLingui = lingui[Object.keys(source).find((k) => source[k].message === message)]?.translation
      out[message] = inlang[message] || fromLingui || (locale === 'en' ? message : '')
    }
    write(`${INLANG}/${locale}.json`, out)
  } else if (mode === 'import') {
    for (const [id, entry] of Object.entries(source)) {
      lingui[id] = { ...(lingui[id] ?? entry), translation: inlang[entry.message] ?? '' }
    }
    write(`${LINGUI}/${locale}.json`, lingui)
  } else {
    console.error('usage: inlang-sync.mjs export|import'); process.exit(1)
  }
}
console.log(`${mode}ed ${locales.join(', ')}`)
