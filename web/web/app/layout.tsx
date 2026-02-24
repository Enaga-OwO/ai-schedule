import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: '生活改善AI | AIと一緒に習慣改善',
  description: 'AIと対話しながら勉強・生活習慣を改善するツール',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '生活改善AI',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-dark-900 text-white min-h-screen">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
