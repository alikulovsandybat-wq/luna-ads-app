import LegalPage from './LegalPage'
import { useI18n } from '../i18n'

const CONTENT = {
  ru: {
    updatedAt: '15 марта 2026',
    updatedLabel: 'Дата обновления',
    title: 'Политика конфиденциальности',
    intro: 'Эта страница описывает, какие данные использует Luna Ads и как они применяются внутри сервиса.',
    sections: [
      {
        heading: '1. Какие данные мы обрабатываем',
        paragraphs: [
          'Luna Ads может обрабатывать Telegram ID пользователя, технические данные мини-приложения, а также токены и идентификаторы рекламных аккаунтов Meta, если пользователь подключает Facebook для работы с рекламой.'
        ]
      },
      {
        heading: '2. Для чего используются данные',
        paragraphs: [
          'Данные используются только для авторизации, отображения статистики, запуска и управления рекламными кампаниями, а также для технической поддержки сервиса.'
        ]
      },
      {
        heading: '3. Передача и хранение',
        paragraphs: [
          'Мы не продаем персональные данные третьим лицам. Данные хранятся в инфраструктуре сервиса и используются только в объеме, необходимом для работы Luna Ads и интеграции с Meta.'
        ]
      },
      {
        heading: '4. Удаление данных',
        paragraphs: [
          'Чтобы запросить удаление данных или отключение интеграции, напишите на testterya@gmail.com.'
        ]
      }
    ]
  },
  en: {
    updatedAt: 'March 15, 2026',
    updatedLabel: 'Last updated',
    title: 'Privacy Policy',
    intro: 'This page explains what data Luna Ads uses and how it is used within the service.',
    sections: [
      {
        heading: '1. What data we process',
        paragraphs: [
          'Luna Ads may process the user’s Telegram ID, technical data of the mini app, as well as tokens and identifiers of Meta ad accounts if the user connects Facebook to work with ads.'
        ]
      },
      {
        heading: '2. Why we use the data',
        paragraphs: [
          'The data is used only for authorization, displaying statistics, launching and managing ad campaigns, and for technical support.'
        ]
      },
      {
        heading: '3. Transfer and storage',
        paragraphs: [
          'We do not sell personal data to third parties. Data is stored in the service infrastructure and used only to the extent necessary for Luna Ads and Meta integration.'
        ]
      },
      {
        heading: '4. Data deletion',
        paragraphs: [
          'To request data deletion or disable the integration, write to testterya@gmail.com.'
        ]
      }
    ]
  },
  kk: {
    updatedAt: '2026 жылғы 15 наурыз',
    updatedLabel: 'Жаңартылған күні',
    title: 'Құпиялылық саясаты',
    intro: 'Бұл бет Luna Ads қандай деректерді пайдаланатынын және олардың сервис ішінде қалай қолданылатынын сипаттайды.',
    sections: [
      {
        heading: '1. Қандай деректерді өңдейміз',
        paragraphs: [
          'Luna Ads пайдаланушының Telegram ID-сін, мини-қосымшаның техникалық деректерін, сондай-ақ пайдаланушы Facebook-ты жарнама үшін қосса, Meta жарнама аккаунттарының токендері мен идентификаторларын өңдеуі мүмкін.'
        ]
      },
      {
        heading: '2. Деректер не үшін қолданылады',
        paragraphs: [
          'Деректер тек авторизация үшін, статистиканы көрсету, жарнамалық кампанияларды іске қосу және басқару, сондай-ақ техникалық қолдау үшін қолданылады.'
        ]
      },
      {
        heading: '3. Беру және сақтау',
        paragraphs: [
          'Біз жеке деректерді үшінші тұлғаларға сатпаймыз. Деректер сервис инфрақұрылымында сақталады және Luna Ads пен Meta интеграциясы үшін қажетті көлемде ғана қолданылады.'
        ]
      },
      {
        heading: '4. Деректерді жою',
        paragraphs: [
          'Деректерді жоюды сұрау немесе интеграцияны өшіру үшін testterya@gmail.com поштасына жазыңыз.'
        ]
      }
    ]
  },
  uz: {
    updatedAt: '2026-yil 15-mart',
    updatedLabel: 'Yangilangan sana',
    title: 'Maxfiylik siyosati',
    intro: 'Bu sahifa Luna Ads qanday ma’lumotlardan foydalanishini va ularning xizmat ichida qanday qo‘llanishini tushuntiradi.',
    sections: [
      {
        heading: '1. Qanday ma’lumotlarni qayta ishlaymiz',
        paragraphs: [
          'Luna Ads foydalanuvchining Telegram IDsi, mini ilovaning texnik ma’lumotlari, shuningdek foydalanuvchi Facebook’ni reklama uchun ulasa, Meta reklama akkauntlarining tokenlari va identifikatorlarini qayta ishlashi mumkin.'
        ]
      },
      {
        heading: '2. Ma’lumotlar nima uchun ishlatiladi',
        paragraphs: [
          'Ma’lumotlar faqat avtorizatsiya, statistikani ko‘rsatish, reklamalarni ishga tushirish va boshqarish, hamda texnik qo‘llab-quvvatlash uchun ishlatiladi.'
        ]
      },
      {
        heading: '3. Uzatish va saqlash',
        paragraphs: [
          'Biz shaxsiy ma’lumotlarni uchinchi shaxslarga sotmaymiz. Ma’lumotlar xizmat infratuzilmasida saqlanadi va Luna Ads hamda Meta integratsiyasi uchun zarur hajmda qo‘llanadi.'
        ]
      },
      {
        heading: '4. Ma’lumotlarni o‘chirish',
        paragraphs: [
          'Ma’lumotlarni o‘chirish yoki integratsiyani o‘chirish uchun testterya@gmail.com manziliga yozing.'
        ]
      }
    ]
  },
  tr: {
    updatedAt: '15 Mart 2026',
    updatedLabel: 'Güncellenme tarihi',
    title: 'Gizlilik Politikası',
    intro: 'Bu sayfa, Luna Ads’in hangi verileri kullandığını ve hizmet içinde nasıl kullanıldığını açıklar.',
    sections: [
      {
        heading: '1. Hangi verileri işliyoruz',
        paragraphs: [
          'Luna Ads, kullanıcının Telegram ID’sini, mini uygulamanın teknik verilerini ve kullanıcı Facebook’u reklam için bağlarsa Meta reklam hesaplarının token ve kimliklerini işleyebilir.'
        ]
      },
      {
        heading: '2. Veriler neden kullanılır',
        paragraphs: [
          'Veriler yalnızca yetkilendirme, istatistik görüntüleme, reklamları başlatma ve yönetme ile teknik destek için kullanılır.'
        ]
      },
      {
        heading: '3. Aktarım ve saklama',
        paragraphs: [
          'Kişisel verileri üçüncü taraflara satmayız. Veriler hizmet altyapısında saklanır ve yalnızca Luna Ads’in çalışması ve Meta entegrasyonu için gerekli ölçüde kullanılır.'
        ]
      },
      {
        heading: '4. Veri silme',
        paragraphs: [
          'Veri silme talebi veya entegrasyonu kapatmak için testterya@gmail.com adresine yazın.'
        ]
      }
    ]
  },
  es: {
    updatedAt: '15 de marzo de 2026',
    updatedLabel: 'Fecha de actualización',
    title: 'Política de privacidad',
    intro: 'Esta página explica qué datos utiliza Luna Ads y cómo se usan dentro del servicio.',
    sections: [
      {
        heading: '1. Qué datos procesamos',
        paragraphs: [
          'Luna Ads puede procesar el ID de Telegram del usuario, los datos técnicos de la mini app y, si el usuario conecta Facebook para anuncios, los tokens e identificadores de cuentas publicitarias de Meta.'
        ]
      },
      {
        heading: '2. Para qué se usan los datos',
        paragraphs: [
          'Los datos se usan solo para autorización, mostrar estadísticas, lanzar y gestionar campañas publicitarias, y soporte técnico.'
        ]
      },
      {
        heading: '3. Transferencia y almacenamiento',
        paragraphs: [
          'No vendemos datos personales a terceros. Los datos se almacenan en la infraestructura del servicio y se usan solo en la medida necesaria para Luna Ads y la integración con Meta.'
        ]
      },
      {
        heading: '4. Eliminación de datos',
        paragraphs: [
          'Para solicitar la eliminación de datos o desactivar la integración, escribe a testterya@gmail.com.'
        ]
      }
    ]
  }
}

export default function Privacy() {
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