# Lingui JS + inlang POC

React + Vite + TypeScript app testing **Lingui** (runtime translations) with an **inlang** project and **Fink** (https://fink.inlang.com) as the translation editor.

Locales: `en` (source), `es`, `fr`, `ja`. The demo page covers plain strings, interpolation, plurals, rich-text `<Trans>`, and date/number formatting.

## Status

| Step | Status |
| --- | --- |
| Lingui runtime translations, per-locale lazy-loaded catalogs | Working (build verified) |
| inlang project valid (`inlang check`) | Working |
| Open the GitHub repo in Fink, edit a translation, sync to GitHub | Working: a Fink edit arrived as a `chore: update translations` commit |
| Fink edit -> `npm run i18n:pull` -> Lingui catalog -> compiled bundle | Working (verified with that Fink edit) |
| ICU plurals/variables as variants/placeholders in Fink | Working in the SDK; check the Fink UI yourself |
| Descriptions from code comments shown in Fink | Written to `en.json` and read correctly by `@inlang/sdk` 4.2.0; **not yet confirmed in the Fink UI** |
| Fink edits applied to the app automatically | **Not implemented**: `i18n:pull` is a manual step (see below) |

## Layout

| Path | Purpose |
| --- | --- |
| `src/locales/{locale}.json` | Lingui catalogs (hashed IDs, `message` + `translation` + `comments`). The app reads these. |
| `inlang-messages/{locale}.json` | inlang message-format files that Fink edits (plurals as `match` variants). |
| `project.inlang/settings.json` | inlang project using `@inlang/plugin-message-format@4.6.0` (pinned, loaded from jsDelivr). |
| `scripts/inlang-sync.mjs` | Converts ICU (Lingui) <-> message format (inlang) using `@inlang/sdk` 2.9.1 + `@inlang/plugin-icu1`. |
| `src/i18n.ts` | Lazy-loads a locale catalog via dynamic `import()` + `i18n.activate()`. |
| `lingui.config.ts` | Lingui config (`lingui` JSON format, so `message` is kept next to `translation`). |

## Commands

```sh
npm install
npm run dev
npm run i18n:push   # lingui extract, then write new/changed messages to inlang-messages/
npm run i18n:pull   # inlang-messages/ -> src/locales/ (run after pulling Fink edits)
```

`i18n:push` and `i18n:pull` fetch two inlang plugins from jsDelivr, so they need network access. Catalogs are compiled by `@lingui/vite-plugin` at import time, so no `lingui compile` step is needed for dev or build (`npm run compile` exists for precompiled output).

## Workflow with Fink

1. Developer adds `<Trans>` / `t` / `<Plural>` in code, then `npm run i18n:push`, and commits `src/locales/` and `inlang-messages/`.
2. Push to GitHub. In Fink, open the repo (`project.inlang/` is at the repo root).
3. Translators edit and sync from Fink. This creates a commit on the branch.
4. A developer runs `git pull`, then `npm run i18n:pull`, and commits `src/locales/`. The app then shows the new text.

Fink only edits the message-format files and syncs them to GitHub. It does not know about Lingui or run `i18n:pull`, so step 4 is manual today. Options to automate it (none built): a GitHub Action on push to `main` that runs `i18n:pull` and commits `src/locales/`; running `i18n:pull` before `vite build` in CI; or serving converted catalogs from a CDN and fetching them at runtime.

## How ICU is handled

Fink's GitHub sync accepts only three resource plugins: **i18next, next-intl and inlang message format**. `@inlang/plugin-icu1` parses ICU well but Fink's sync rejects it (`Unsupported resource plugins: plugin.inlang.icu-messageformat-1`). So Fink edits message-format files, and `scripts/inlang-sync.mjs` converts to and from ICU by running the SDK with `plugin-icu1` on one side and `plugin-message-format` on the other (no hand-written ICU parser).

- `{count, plural, one {...} other {...}}` becomes a `count` input, a `countPlural` selector and one `match` variant per category (`countPlural=one`, `countPlural=*`). Locales with fewer categories (ja: only `*`) have fewer variants.
- `{name}` stays a placeholder; `#` becomes `{count: icu:pound}`.
- `<0>…</0>` rich-text tags from `<Trans>` stay **plain text** (not converted to message-format markup such as `{#b}…{/b}`), so translators can still break them.
- ICU strings coming back are canonicalized, e.g. `{count, plural, other {未読メッセージが#件あります}}` becomes `未読メッセージが{count, plural, other {#}}件あります`. All four locales render identically through Lingui before and after for counts 0, 1, 2, 5 and 21 (240 comparisons, 0 mismatches).

## Translator descriptions from code

Add a `comment` in code and it becomes the message description in Fink (the "Add description" field):

```tsx
<Trans comment="Greeting. {name} is the user's first name.">Hello, {name}!</Trans>
t({ message: 'Your name', comment: 'Accessible label for the name input.' })
<Plural value={count} comment="# is replaced by the number." one="…" other="…" />
```

`lingui extract` stores comments in the catalog's `comments`. `npm run i18n:push` writes them as `description` on the **source-locale** (`en`) entry in `inlang-messages/en.json`, where the message-format plugin keeps bundle descriptions:

```json
"3eEmBT": [{ "description": "Greeting. …", "match": { "*": "Hello, {name}!" } }]
```

- Code wins: a comment in code overwrites the description. A description added only in Fink is kept when the code has no comment.
- Comments don't change message IDs, so existing translations stay valid.
- `@inlang/sdk` 4.2.0 loads the 5 commented demo messages with `bundle.description` set.
- Not yet verified: that Fink shows these descriptions, or writes a description typed in the UI back to `en.json`.

## Findings

- **No Lingui-specific inlang plugin.** Lingui catalogs are ICU, and the ICU plugin parses them, but Fink's sync only accepts i18next, next-intl and message-format files, hence the conversion script.
- **Keys are Lingui's hashed IDs** (Fink shows the English source next to each key). A whole ICU message is not a sensible bundle ID, so source-text keys were dropped. Editing a source string still changes its hash, which orphans existing translations. Explicit IDs would avoid that.
- **Vite 8:** `@vitejs/plugin-react` 6 no longer uses Babel. `vite.config.ts` still adds `@rolldown/plugin-babel` with `linguiTransformerBabelPreset()`, but `@lingui/vite-plugin` now warns it has a built-in macro transform, so the Babel setup is probably removable (untested).
- Runtime loading uses per-locale chunks. Fetching catalogs from a CDN instead would allow updates without a rebuild (not implemented).
- Plugins are referenced by pinned version from jsDelivr because Fink can't resolve local `node_modules` plugin paths.
- `@inlang/sdk` 4.x renamed its tables (`inlang_bundle`, …). The sync script pins 2.9.1, which has no description support, so descriptions are added by editing the exported JSON after conversion.
- **npm registry:** a corporate registry (e.g. Artifactory) gets baked into `package-lock.json` `resolved` URLs. Rewrite them to `https://registry.npmjs.org/` before sharing.

## Troubleshooting Fink

- **Still shows an old version or old keys:** Fink caches the project in the browser. Clear site data for `fink.inlang.com` and reopen the repo. Check unsynced edits first.
- **`Sync with GitHub failed … Unsupported resource plugins`:** the project uses a plugin Fink's sync doesn't accept. Use message format, i18next or next-intl.
- **A request for a Fink asset (e.g. `direct-*.js`) hangs or `Lix open did not settle`:** this was a Fink-side outage for a while. Retry later after a hard refresh.
