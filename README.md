# Lingui JS + inlang POC

React + Vite + TypeScript app testing **Lingui** (runtime translations) with **inlang** (project) and **Fink** (https://fink.inlang.com) as the translation editor.

Locales: `en` (source), `es`, `fr`, `ja`. Demo covers plain strings, interpolation, plurals, rich-text `<Trans>`, and date/number formatting.

## Layout

| Path | Purpose |
| --- | --- |
| `src/locales/{locale}.json` | Lingui catalogs (hashed IDs, `message` + `translation`). Source of truth for the app. |
| `inlang-locales/{locale}.json` | Flat `"source message": "translation"` files that inlang/Fink edit. |
| `project.inlang/settings.json` | inlang project (i18next plugin, pointing at `inlang-locales/`). |
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
2. Push to a GitHub repo. In Fink, open the repo (Fink > Open project > GitHub; the repo must contain `project.inlang/`).
3. Translators edit and sync to the repo from Fink.
4. Developer pulls, runs `npm run i18n:pull`, commits `src/locales/`, and the app picks up the new text.

> Untested: whether Fink requires `project.inlang/` at the repo root and/or a specific branch. It now sits at the repo root of this branch, so pushing the branch to GitHub is enough to try it.

## Findings

- **No native Lingui plugin for inlang.** `@inlang/plugin-i18next` reads flat JSON, which fits Lingui's "minimal" shape, but Lingui's IDs are hashes. Hence the sync script keys inlang files by source message so translators see readable text.
- **ICU strings are edited as raw text** in Fink. The i18next plugin only understands `{{var}}`, so `{count, plural, ...}`, `{name}` and `<0>` tags are not parsed or validated; translators can break them. A custom inlang plugin (ICU-aware) would be the real fix.
- **Changing a source message changes its key** in inlang, so existing translations are orphaned (dropped by `export`). Explicit IDs would avoid this.
- Plural categories per language (e.g. `many` in es/fr, only `other` in ja) have to be written by translators inside the ICU string.
- Vite 8 + `@vitejs/plugin-react` 6 no longer use Babel, so macros require `@rolldown/plugin-babel` + `linguiTransformerBabelPreset()` (see `vite.config.ts`).
- Runtime loading uses per-locale chunks. Fetching catalogs from a CDN instead would allow updates without a rebuild (not implemented).
- Fink was not exercised end to end here: only `inlang validate` was run against the project.
