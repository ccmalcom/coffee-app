import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Fraunces, Karla } from 'next/font/google'
import { NavBar } from '@/components/layout/NavBar'
import './globals.css'

const APP_NAME = 'Coffee App'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const karla = Karla({
  subsets: ['latin'],
  variable: '--font-karla',
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s - ${APP_NAME}` },
  description: 'Personal espresso coffee log, grind dial-in, and discovery.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#1E1812',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="pb-16 md:pb-0">
        <NavBar />
        {children}
      </body>
    </html>
  )
}
