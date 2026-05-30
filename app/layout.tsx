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
              background: '#ffffff',
              color: '#26211d',
              fontSize: '14px',
              border: '1px solid #e7dfd6',
              boxShadow: '0 12px 30px rgba(38, 33, 29, 0.12)',
            },
            success: {
              iconTheme: { primary: '#2f5d50', secondary: '#ffffff' },
            },
            error: {
              iconTheme: { primary: '#b42318', secondary: '#ffffff' },
            },
          }}
        />
      </body>
    </html>
  )
}
