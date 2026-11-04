# Lingui JS + inlang POC

React + Vite + TypeScript app testing **Lingui** (runtime translations) with **inlang** (project) and **Fink** (https://fink.inlang.com) as the translation editor, using the ICU-aware `@inlang/plugin-icu1`.

Locales: `en` (source), `es`, `fr`, `ja`. Demo covers plain strings, interpolation, plurals, rich-text `<Trans>`, and date/number formatting.

## Layout

| Path | Purpose |
| --- | --- |
| `src/locales/{locale}.json` | Lingui catalogs (hashed IDs, `message` + `translation`). Source of truth for the app. |
| `inlang-locales/{locale}.json` | Flat `"lingui id": "ICU string"` files that inlang/Fink edit. |
| `project.inlang/settings.json` | inlang project using `@inlang/plugin-icu1` (pinned, loaded from jsDelivr). |
| `scripts/inlang-sync.mjs` | Converts between the two catalog shapes. |
| `src/i18n.ts` | Lazy-loads a locale catalog via dynamic `import()` + `i18n.activate()`. |

## Commands

```sh
npm install
npm run dev
npm run i18n:push   # lingui extract -> write new/changed messages to inlang-locales/
npm run i18n:pull   # inlang-locales/ -> src/locales/ (run after pulling Fink edits)
```

Catalogs are compiled by the `@lingui/vite-plugin` at import time, so no `lingui compile` step is needed for dev/build (`npm run compile` exists if you want precompiled output).

## Workflow with Fink

1. Developer adds `<Trans>`/`t`/`plural` in code, then `npm run i18n:push` and commits `inlang-locales/`.
2. Push to GitHub. In Fink, open the repo (it contains `project.inlang/` at the root).
3. Translators edit and sync to the repo from Fink.
4. Developer pulls, runs `npm run i18n:pull`, commits `src/locales/`, and the app picks up the new text.

## How ICU is handled

`@inlang/plugin-icu1` parses each ICU string into inlang's data model. Checked with `@inlang/sdk` 2.9.1 (load project, inspect, export):

- `{count, plural, one {...} other {...}}` becomes a `count` input variable, a plural selector and one variant per category. A locale with fewer categories (ja: `other` only) just has fewer variants.
- `{name}` becomes an expression, and `#` becomes a placeholder expression, instead of raw text.
- `<0>…</0>` rich-text tags from `<Trans>` stay **plain text** (the plugin does not parse markup), so translators can still break them.
- **Export is canonicalized.** Shared text is moved outside the plural, e.g. `{count, plural, other {未読メッセージが#件あります}}` becomes `未読メッセージが{count, plural, other {#}}件あります`. After the first Fink sync the files will look like this. Rendering through Lingui was compared before/after for counts 0, 1, 2, 5 and 21 in all four locales: identical output.

## Findings

- **No Lingui-specific inlang plugin**, but the generic ICU plugin works, because Lingui catalogs are ICU MessageFormat. A conversion script is still needed because Lingui keys by hashed ID and wraps entries in objects.
- **Keys are Lingui's hashed IDs** (Fink shows the English source next to each key). A whole ICU message is not a sensible bundle ID, so source-text keys were dropped. Editing a source string still changes its hash, which orphans existing translations. Explicit IDs would avoid that.
- Vite 8 + `@vitejs/plugin-react` 6 no longer use Babel; macros are handled by `@lingui/vite-plugin` (see `vite.config.ts`).
- Runtime loading uses per-locale chunks. Fetching catalogs from a CDN instead would allow updates without a rebuild (not implemented).
- The plugin is referenced by pinned version from jsDelivr because Fink can't resolve local `node_modules` plugin paths.
- Local npm registry gotcha: an Artifactory registry gets baked into `package-lock.json` `resolved` URLs. Rewrite them to `https://registry.npmjs.org/` before sharing.
