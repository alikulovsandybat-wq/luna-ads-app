import styles from './LanguageSwitcher.module.css'
import { useI18n } from '../i18n'

// Добавили { className } в скобки, чтобы принимать стили снаружи
export default function LanguageSwitcher({ className }) {
  const { lang, setLang, languages } = useI18n()

  return (
    /* Если className передан, используем его, если нет — берем стандартный wrap */
    <div className={className || styles.wrap}>
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
