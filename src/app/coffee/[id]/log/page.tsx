import Link from 'next/link'
import { listEquipment } from '@/lib/actions/equipment'
import { getLastShot } from '@/lib/actions/shots'
import { ShotForm } from '@/components/shots/ShotForm'

export default async function LogShotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [grinders, machines, prefill] = await Promise.all([
    listEquipment('grinder'),
    listEquipment('machine'),
    getLastShot(id),
  ])

  if (grinders.length === 0 || machines.length === 0) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <h1 className="text-xl font-display font-semibold mb-2">Log shot</h1>
        <p className="text-sm text-text-muted">
          Add at least one grinder and one machine first.{' '}
          <Link href="/equipment" className="text-accent underline">
            Go to Equipment
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-display font-semibold mb-3">Log shot</h1>
      <ShotForm coffeeId={id} grinders={grinders} machines={machines} prefill={prefill} />
    </main>
  )
}
