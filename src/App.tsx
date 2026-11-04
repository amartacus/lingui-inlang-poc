import { t } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { activate, locales, type Locale } from './i18n'
import './App.css'

export default function App() {
  const { i18n } = useLingui()
  const [count, setCount] = useState(1)
  const [name, setName] = useState('Alex')

  return (
    <main className="app">
      <header>
        <h1><Trans comment="Page title shown in the header. Keep 'Lingui' and 'inlang' untranslated (product names).">Lingui + inlang POC</Trans></h1>
        <label>
          <Trans>Language</Trans>:{' '}
          <select value={i18n.locale} onChange={(e) => activate(e.target.value as Locale)}>
            {Object.entries(locales).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
      </header>

      <section>
        <h2><Trans>Plain string</Trans></h2>
        <p><Trans>Translations are loaded at runtime from per-locale catalogs.</Trans></p>
      </section>

      <section>
        <h2><Trans>Interpolation</Trans></h2>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t({ message: 'Your name', comment: 'Accessible label for the name input. Not visible on screen.' })} />
        <p><Trans comment="Greeting. {name} is the user's first name as typed in the input above.">Hello, {name}!</Trans></p>
      </section>

      <section>
        <h2><Trans>Plurals</Trans></h2>
        <button onClick={() => setCount((c) => Math.max(0, c - 1))}>−</button>
        <button onClick={() => setCount((c) => c + 1)}>+</button>
        <p>
          <Plural
            value={count}
            comment="Unread-message counter. # is replaced by the number. Provide every plural category your language needs."
            one="You have # unread message"
            other="You have # unread messages"
          />
        </p>
      </section>

      <section>
        <h2><Trans>Rich text</Trans></h2>
        <p>
          <Trans comment="Keep the <0> (link) and <1> (bold) tags and their order around the same words.">
            Edit translations in <a href="https://fink.inlang.com" target="_blank">Fink</a> and
            see <strong>updated copy</strong> after a sync.
          </Trans>
        </p>
      </section>

      <section>
        <h2><Trans>Formatting</Trans></h2>
        <p>{i18n.date(new Date(), { dateStyle: 'full' })}</p>
        <p>{i18n.number(1234567.89, { style: 'currency', currency: 'USD' })}</p>
      </section>
    </main>
  )
}
