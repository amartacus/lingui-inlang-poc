#!/usr/bin/env node
// Bridges Lingui catalogs and the files Fink edits.
//
//   src/locales/{locale}.json         Lingui: id -> { message, translation, ... }   (ICU strings)
//   inlang-messages/{locale}.json     inlang message format: plurals as `match` variants
//
// Fink's GitHub sync only supports the i18next, next-intl and inlang message-format
// plugins (not plugin-icu1), so ICU <-> message-format conversion is done here using the
// inlang SDK: plugin-icu1 parses ICU, plugin-message-format writes/reads the Fink files.
//
// Translator descriptions: Lingui `comment` props (extracted to the catalog's `comments`) are
// written to the source-locale (en) message-format entry as `description`, which Fink shows
// as the message description. Code wins; a description added only in Fink is kept when the
// code has no comment.
//
//   node scripts/inlang-sync.mjs export   # lingui -> inlang  (after `lingui extract`)
//   node scripts/inlang-sync.mjs import   # inlang -> lingui  (after pulling Fink edits)
import { loadProjectInMemory, newProject } from '@inlang/sdk'
import fs from 'node:fs'

const LINGUI = 'src/locales'
const INLANG = 'inlang-messages'
const ICU = 'plugin.inlang.icu-messageformat-1'
const MF = 'plugin.inlang.messageFormat'
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {})
const write = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
const locales = fs.readdirSync(LINGUI).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))

// Convert { locale: object } between ICU files and message-format files via the SDK.
async function convert(from, to, byLocale) {
  const blob = await newProject({
    settings: {
      baseLocale: 'en',
      locales,
      modules: [
        'https://cdn.jsdelivr.net/npm/@inlang/plugin-icu1@1.3.8/dist/index.js',
        'https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4.6.0/dist/index.js',
      ],
      [ICU]: { pathPattern: './unused-icu/{locale}.json' },
      [MF]: { pathPattern: './unused-mf/{locale}.json' },
    },
  })
  const project = await loadProjectInMemory({ blob })
  const files = Object.entries(byLocale).map(([locale, obj]) => ({
    locale,
    content: new TextEncoder().encode(JSON.stringify(obj)),
  }))
  await project.importFiles({ pluginKey: from, files })
  const out = await project.exportFiles({ pluginKey: to })
  await project.close()
  return Object.fromEntries(out.map((f) => [f.locale, JSON.parse(new TextDecoder().decode(f.content))]))
}

// message-format entries are either a string or [{ description?, declarations?, selectors?, match }]
const getDescription = (entry) => (Array.isArray(entry) ? entry[0]?.description : undefined)
function withDescription(entry, description) {
  if (!description) return entry
  if (Array.isArray(entry)) return [{ description, ...entry[0] }, ...entry.slice(1)]
  return [{ description, match: { '*': entry } }]
}

const mode = process.argv[2]
if (!['export', 'import'].includes(mode)) {
  console.error('usage: inlang-sync.mjs export|import')
  process.exit(1)
}
const source = read(`${LINGUI}/en.json`)
const catalogs = Object.fromEntries(locales.map((l) => [l, read(`${LINGUI}/${l}.json`)]))

if (mode === 'export') {
  // Existing Fink edits win over Lingui's copy; en always mirrors the source message.
  const existing = fs.existsSync(INLANG)
    ? await convert(MF, ICU, Object.fromEntries(locales.filter((l) => fs.existsSync(`${INLANG}/${l}.json`)).map((l) => [l, read(`${INLANG}/${l}.json`)])))
    : {}
  const icu = {}
  for (const l of locales) {
    icu[l] = {}
    for (const [id, entry] of Object.entries(source)) {
      const value = l === 'en' ? entry.message : existing[l]?.[id] || catalogs[l][id]?.translation
      if (value) icu[l][id] = value
    }
  }
  const mf = await convert(ICU, MF, icu)
  const previousEn = read(`${INLANG}/en.json`)
  for (const [id, entry] of Object.entries(mf.en ?? {})) {
    if (id === '$schema') continue
    const fromCode = source[id]?.comments?.join(' ').trim()
    mf.en[id] = withDescription(entry, fromCode || getDescription(previousEn[id]))
  }
  fs.mkdirSync(INLANG, { recursive: true })
  for (const l of locales) write(`${INLANG}/${l}.json`, mf[l])
} else {
  const icu = await convert(MF, ICU, Object.fromEntries(locales.map((l) => [l, read(`${INLANG}/${l}.json`)])))
  for (const l of locales) {
    for (const [id, entry] of Object.entries(source)) {
      catalogs[l][id] = { ...(catalogs[l][id] ?? entry), translation: icu[l]?.[id] ?? '' }
    }
    write(`${LINGUI}/${l}.json`, catalogs[l])
  }
}
console.log(`${mode}ed ${locales.join(', ')}`)
