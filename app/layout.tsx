import './globals.css'
import { LanguageProvider } from '@/lib/hooks/LanguageContext'
// EĞER BURADA "import LanguageToggle..." VARSA ONU DA SİLEBİLİRSİN

export const metadata = {
  title: 'Personal Dashboard',
  description: 'Mali Kontrol ve Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body>
        {/* Tüm siteyi LanguageProvider ile sarıyoruz */}
        <LanguageProvider>

          {/* Sitenin geri kalan içeriği (Buton artık sadece bunun içinde yaşıyor) */}
          {children}

        </LanguageProvider>
      </body>
    </html>
  )
}
