import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kuiper Holland - B2B Webshop',
  description: 'B2B webshop voor fineer en HPL-gecoate plaatmaterialen voor interieurbouwers.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" className="h-full">
      <body className="min-h-full flex flex-col" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif' }}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '8px',
              background: '#1f2937',
              color: '#f9fafb',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#f9fafb' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#f9fafb' },
            },
          }}
        />
      </body>
    </html>
  )
}
