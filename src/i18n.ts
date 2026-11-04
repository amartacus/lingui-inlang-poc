import { i18n } from '@lingui/core'

export const locales = { en: 'English', es: 'Español', fr: 'Français', ja: '日本語' } as const
export type Locale = keyof typeof locales

// Runtime translations: each catalog is a separate lazily-loaded chunk.
// `lingui()` Vite plugin compiles the .json catalog when it is imported.
export async function activate(locale: Locale) {
  const { messages } = await import(`./locales/${locale}.json`)
  i18n.load(locale, messages)
  i18n.activate(locale)
}
