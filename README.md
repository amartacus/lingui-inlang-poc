# Lingui JS + inlang POC

React + Vite + TypeScript app testing **Lingui** (runtime translations) with **inlang** (project) and **Fink** (https://fink.inlang.com) as the translation editor, using inlang's native message format so plurals and variables are editable as variants and placeholders.

Locales: `en` (source), `es`, `fr`, `ja`. Demo covers plain strings, interpolation, plurals, rich-text `<Trans>`, and date/number formatting.

## Layout

| Path | Purpose |
| --- | --- |
| `src/locales/{locale}.json` | Lingui catalogs (hashed IDs, `message` + `translation`). Source of truth for the app. |
| `inlang-messages/{locale}.json` | inlang message-format files that Fink edits (plurals as `match` variants). |
| `project.inlang/settings.json` | inlang project using `@inlang/plugin-message-format` (pinned, loaded from jsDelivr). |
| `scripts/inlang-sync.mjs` | Converts ICU (Lingui) <-> message format (inlang) using `@inlang/sdk` + `@inlang/plugin-icu1`. |
| `src/i18n.ts` | Lazy-loads a locale catalog via dynamic `import()` + `i18n.activate()`. |

## Commands

```sh
npm install
npm run dev
npm run i18n:push   # lingui extract -> write new/changed messages to inlang-messages/
npm run i18n:pull   # inlang-messages/ -> src/locales/ (run after pulling Fink edits)
```

Catalogs are compiled by the `@lingui/vite-plugin` at import time, so no `lingui compile` step is needed for dev/build (`npm run compile` exists if you want precompiled output).

## Workflow with Fink

1. Developer adds `<Trans>`/`t`/`plural` in code, then `npm run i18n:push` and commits `inlang-messages/`.
2. Push to GitHub. In Fink, open the repo (it contains `project.inlang/` at the root).
3. Translators edit and sync to the repo from Fink.
4. Developer pulls, runs `npm run i18n:pull`, commits `src/locales/`, and the app picks up the new text.

## How ICU is handled

Fink's GitHub sync accepts only three resource plugins: **i18next, next-intl and inlang message format**. `@inlang/plugin-icu1` works with the SDK but Fink's sync rejects it (`Unsupported resource plugins: plugin.inlang.icu-messageformat-1`). So Fink edits message-format files, and `scripts/inlang-sync.mjs` converts to and from ICU by running the SDK with `plugin-icu1` on one side and `plugin-message-format` on the other (no hand-written ICU parser).

- `{count, plural, one {...} other {...}}` becomes a `count` input, a `countPlural` selector and one `match` variant per category (`countPlural=one`, `countPlural=*`). Locales with fewer categories (ja: only `*`) have fewer variants.
- `{name}` stays a placeholder; `#` becomes `{count: icu:pound}`.
- `<0>…</0>` rich-text tags from `<Trans>` stay **plain text** (not converted to message-format markup), so translators can still break them.
- The ICU strings that come back are canonicalized, e.g. `{count, plural, other {未読メッセージが#件あります}}` becomes `未読メッセージが{count, plural, other {#}}件あります`. Checked: all four locales render identically through Lingui for counts 0, 1, 2, 5 and 21 (240 comparisons, 0 mismatches), and a simulated edit to one plural variant reached the Lingui catalog.

## Translator descriptions from code

Add a `comment` in code and it becomes the message description in Fink (the "Add description" field):

```tsx
<Trans comment="Greeting. {name} is the user's first name.">Hello, {name}!</Trans>
t({ message: 'Your name', comment: 'Accessible label for the name input.' })
<Plural value={count} comment="# is replaced by the number." one="…" other="…" />
```

`lingui extract` stores comments in the catalog's `comments`. `npm run i18n:push` writes them as `description` on the **source-locale** (`en`) entry in `inlang-messages/en.json`, which is where the message-format plugin keeps bundle descriptions:

```json
"3eEmBT": [{ "description": "Greeting. …", "match": { "*": "Hello, {name}!" } }]
```

- Code wins: a comment in code overwrites the description. A description added only in Fink is kept when the code has no comment.
- Comments don't change message IDs, so existing translations stay valid.
- Checked with `@inlang/sdk` 4.2.0: the 5 commented messages load with `bundle.description` set.
- Not yet verified: that Fink shows the description from `en.json`, or writes UI edits back to it.

## Findings

- **No Lingui-specific inlang plugin.** Lingui catalogs are ICU, and the ICU plugin parses them, but Fink's sync only accepts i18next, next-intl and message-format files, hence the conversion script. Fink was found to be stale (based on an old commit) because that sync failed.
- **Keys are Lingui's hashed IDs** (Fink shows the English source next to each key). A whole ICU message is not a sensible bundle ID, so source-text keys were dropped. Editing a source string still changes its hash, which orphans existing translations. Explicit IDs would avoid that.
- Vite 8 + `@vitejs/plugin-react` 6 no longer use Babel; macros are handled by `@lingui/vite-plugin` (see `vite.config.ts`).
- Runtime loading uses per-locale chunks. Fetching catalogs from a CDN instead would allow updates without a rebuild (not implemented).
- Plugins are referenced by pinned version from jsDelivr because Fink can't resolve local `node_modules` plugin paths. The sync script also fetches both plugins from jsDelivr, so it needs network access.
- `@inlang/sdk` 4.x renamed the tables (`inlang_bundle`, …). The sync script pins 2.9.1, whose `description` support is absent, so descriptions are added by editing the exported JSON rather than through the SDK.
- Local npm registry gotcha: an Artifactory registry gets baked into `package-lock.json` `resolved` URLs. Rewrite them to `https://registry.npmjs.org/` before sharing.
