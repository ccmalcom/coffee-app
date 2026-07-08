import Link from 'next/link'

export function NavBar() {
  return (
    <nav className="border-t fixed bottom-0 left-0 right-0 bg-white flex justify-around py-2 md:static md:border-t-0 md:border-b md:justify-start md:gap-6 md:px-4">
      <Link href="/library" className="text-sm">Library</Link>
      <Link href="/coffee/add" className="text-sm">Add</Link>
    </nav>
  )
}
