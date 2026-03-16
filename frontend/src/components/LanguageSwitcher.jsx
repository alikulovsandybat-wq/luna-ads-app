import styles from './LanguageSwitcher.module.css'
import { useI18n } from '../i18n'

export default function LanguageSwitcher() {
  const { lang, setLang, languages } = useI18n()

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        value={lang}
        onChange={(event) => setLang(event.target.value)}
        aria-label="Language"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>{item.label}</option>
        ))}
      </select>
    </div>
  )
}