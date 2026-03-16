import styles from './LegalPage.module.css'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function LegalPage({
  eyebrow = 'Luna Ads',
  title,
  updatedAt,
  updatedLabel = 'Дата обновления',
  intro,
  sections
}) {
  return (
    <div className={styles.page}>
      <LanguageSwitcher />
      <article className={styles.card}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.meta}>{updatedLabel}: {updatedAt}</p>
        <p className={styles.intro}>{intro}</p>

        <div className={styles.sections}>
          {sections.map(section => (
            <section key={section.heading} className={styles.section}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </div>
  )
}