import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-json'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
  catalogs: [{ path: '<rootDir>/src/locales/{locale}', include: ['src'] }],
  // "lingui" style keeps both the source `message` and the `translation`,
  // which scripts/inlang-sync.mjs needs to build human-readable inlang files.
  format: formatter({ style: 'lingui' }),
})
