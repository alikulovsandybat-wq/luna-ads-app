import LegalPage from './LegalPage'
import { useI18n } from '../i18n'

const CONTENT = {
  ru: {
    updatedAt: '15 марта 2026',
    updatedLabel: 'Дата обновления',
    title: 'Пользовательское соглашение',
    intro: 'Эта страница описывает базовые условия использования Luna Ads и ответственность сторон при работе с сервисом.',
    sections: [
      {
        heading: '1. Общие положения',
        paragraphs: [
          'Luna Ads предоставляет пользователю доступ к инструментам просмотра статистики и управления рекламой Meta через Telegram Mini App.'
        ]
      },
      {
        heading: '2. Использование сервиса',
        paragraphs: [
          'Пользователь обязуется использовать сервис законно, не нарушать правила Telegram, Meta и применимые требования рекламных платформ.'
        ]
      },
      {
        heading: '3. Ответственность пользователя',
        paragraphs: [
          'Пользователь самостоятельно отвечает за содержание рекламных материалов, настройки кампаний, бюджет и соответствие рекламной деятельности требованиям Meta.'
        ]
      },
      {
        heading: '4. Ограничение ответственности',
        paragraphs: [
          'Luna Ads не гарантирует конкретные рекламные результаты и не несет ответственность за решения платформ Meta, блокировки, отклонение объявлений или иные внешние ограничения.'
        ]
      }
    ]
  },
  en: {
    updatedAt: 'March 15, 2026',
    updatedLabel: 'Last updated',
    title: 'Terms of Service',
    intro: 'This page describes the basic terms of using Luna Ads and the responsibilities of the parties while using the service.',
    sections: [
      {
        heading: '1. General provisions',
        paragraphs: [
          'Luna Ads provides the user access to tools for viewing statistics and managing Meta ads via a Telegram Mini App.'
        ]
      },
      {
        heading: '2. Use of the service',
        paragraphs: [
          'The user agrees to use the service lawfully and comply with Telegram, Meta and applicable advertising platform requirements.'
        ]
      },
      {
        heading: '3. User responsibility',
        paragraphs: [
          'The user is responsible for ad content, campaign settings, budget, and compliance with Meta requirements.'
        ]
      },
      {
        heading: '4. Limitation of liability',
        paragraphs: [
          'Luna Ads does not guarantee specific advertising results and is not liable for Meta decisions, account restrictions, ad rejections, or other external limitations.'
        ]
      }
    ]
  },
  kk: {
    updatedAt: '2026 жылғы 15 наурыз',
    updatedLabel: 'Жаңартылған күні',
    title: 'Пайдаланушы келісімі',
    intro: 'Бұл бет Luna Ads қызметін пайдалану шарттары мен тараптардың жауапкершілігін сипаттайды.',
    sections: [
      {
        heading: '1. Жалпы ережелер',
        paragraphs: [
          'Luna Ads пайдаланушыға Telegram Mini App арқылы Meta жарнамасының статистикасын қарау және басқару құралдарына қол жеткізуді ұсынады.'
        ]
      },
      {
        heading: '2. Қызметті пайдалану',
        paragraphs: [
          'Пайдаланушы сервисті заңды түрде қолдануға, Telegram, Meta және қолданылатын жарнама платформаларының талаптарын сақтауға міндетті.'
        ]
      },
      {
        heading: '3. Пайдаланушы жауапкершілігі',
        paragraphs: [
          'Пайдаланушы жарнамалық материалдардың мазмұнына, кампания баптауларына, бюджетке және Meta талаптарына сәйкестікке өзі жауап береді.'
        ]
      },
      {
        heading: '4. Жауапкершілікті шектеу',
        paragraphs: [
          'Luna Ads нақты жарнамалық нәтижелерге кепілдік бермейді және Meta платформаларының шешімдері, бұғаттаулар, жарнамалардың қабылданбауы немесе өзге сыртқы шектеулер үшін жауап бермейді.'
        ]
      }
    ]
  },
  uz: {
    updatedAt: '2026-yil 15-mart',
    updatedLabel: 'Yangilangan sana',
    title: 'Foydalanish shartnomasi',
    intro: 'Bu sahifa Luna Ads’dan foydalanishning asosiy shartlari va tomonlarning javobgarligini tasvirlaydi.',
    sections: [
      {
        heading: '1. Umumiy qoidalar',
        paragraphs: [
          'Luna Ads foydalanuvchiga Telegram Mini App orqali Meta reklamalari statistikasi va boshqaruv vositalaridan foydalanish imkonini beradi.'
        ]
      },
      {
        heading: '2. Xizmatdan foydalanish',
        paragraphs: [
          'Foydalanuvchi xizmatdan qonuniy foydalanishga, Telegram, Meta va reklama platformalari talablariga rioya qilishga majbur.'
        ]
      },
      {
        heading: '3. Foydalanuvchi javobgarligi',
        paragraphs: [
          'Foydalanuvchi reklama materiallari mazmuni, kampaniya sozlamalari, budjet va Meta talablariga muvofiqlik uchun javob beradi.'
        ]
      },
      {
        heading: '4. Mas’uliyatni cheklash',
        paragraphs: [
          'Luna Ads aniq reklama natijalarini kafolatlamaydi va Meta platformalari qarorlari, blokirovkalar, e’lonlarning rad etilishi yoki boshqa tashqi cheklovlar uchun javobgar emas.'
        ]
      }
    ]
  },
  tr: {
    updatedAt: '15 Mart 2026',
    updatedLabel: 'Güncellenme tarihi',
    title: 'Kullanım Şartları',
    intro: 'Bu sayfa, Luna Ads kullanımının temel şartlarını ve tarafların sorumluluklarını açıklar.',
    sections: [
      {
        heading: '1. Genel hükümler',
        paragraphs: [
          'Luna Ads, kullanıcıya Telegram Mini App üzerinden Meta reklam istatistiklerini görüntüleme ve yönetme araçlarına erişim sağlar.'
        ]
      },
      {
        heading: '2. Hizmetin kullanımı',
        paragraphs: [
          'Kullanıcı, hizmeti yasal şekilde kullanmayı ve Telegram, Meta ile reklam platformlarının geçerli gereksinimlerine uymayı kabul eder.'
        ]
      },
      {
        heading: '3. Kullanıcı sorumluluğu',
        paragraphs: [
          'Kullanıcı, reklam içerikleri, kampanya ayarları, bütçe ve Meta gereksinimlerine uygunluktan sorumludur.'
        ]
      },
      {
        heading: '4. Sorumluluğun sınırlandırılması',
        paragraphs: [
          'Luna Ads belirli reklam sonuçlarını garanti etmez ve Meta platformlarının kararları, engellemeler, reklam reddi veya diğer dış kısıtlamalar için sorumlu değildir.'
        ]
      }
    ]
  },
  es: {
    updatedAt: '15 de marzo de 2026',
    updatedLabel: 'Fecha de actualización',
    title: 'Términos de servicio',
    intro: 'Esta página describe las condiciones básicas de uso de Luna Ads y la responsabilidad de las partes al usar el servicio.',
    sections: [
      {
        heading: '1. Disposiciones generales',
        paragraphs: [
          'Luna Ads proporciona al usuario acceso a herramientas para ver estadísticas y gestionar anuncios de Meta a través de Telegram Mini App.'
        ]
      },
      {
        heading: '2. Uso del servicio',
        paragraphs: [
          'El usuario se compromete a usar el servicio legalmente y a cumplir las normas de Telegram, Meta y los requisitos aplicables de las plataformas publicitarias.'
        ]
      },
      {
        heading: '3. Responsabilidad del usuario',
        paragraphs: [
          'El usuario es responsable del contenido de los anuncios, la configuración de las campañas, el presupuesto y el cumplimiento de los requisitos de Meta.'
        ]
      },
      {
        heading: '4. Limitación de responsabilidad',
        paragraphs: [
          'Luna Ads no garantiza resultados publicitarios concretos y no es responsable de las decisiones de Meta, bloqueos, rechazo de anuncios u otras limitaciones externas.'
        ]
      }
    ]
  }
}

export default function Terms() {
  const { lang } = useI18n()
  const content = CONTENT[lang] || CONTENT.ru

  return (
    <LegalPage
      title={content.title}
      updatedAt={content.updatedAt}
      updatedLabel={content.updatedLabel}
      intro={content.intro}
      sections={content.sections}
    />
  )
}