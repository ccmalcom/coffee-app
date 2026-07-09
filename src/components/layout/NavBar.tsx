'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/library', label: 'Library' },
  { href: '/coffee/add', label: 'Add' },
  { href: '/equipment', label: 'Equipment' },
  { href: '/profile', label: 'Profile' },
] as const

export function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-surface-raised bg-surface py-2 md:static md:justify-start md:gap-6 md:border-t-0 md:border-b md:px-4">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm ${active ? 'text-accent' : 'text-text-muted'}`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
