import { listEquipment } from '@/lib/actions/equipment'
import { EquipmentForm } from '@/components/equipment/EquipmentForm'

export default async function EquipmentPage() {
  const items = await listEquipment()
  const grinders = items.filter((i) => i.kind === 'grinder')
  const machines = items.filter((i) => i.kind === 'machine')

  return (
    <main className="max-w-lg mx-auto p-4 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Equipment</h1>

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Grinders</h2>
        {grinders.length === 0 ? (
          <p className="text-sm text-gray-400">No grinders yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {grinders.map((g) => (
              <li key={g.id} className="text-sm border rounded p-2">
                {g.nickname}
                {g.microStepsPerMacroNotch !== null && (
                  <span className="text-gray-400">
                    {' '}
                    · micro ÷{g.microStepsPerMacroNotch}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Machines</h2>
        {machines.length === 0 ? (
          <p className="text-sm text-gray-400">No machines yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {machines.map((m) => (
              <li key={m.id} className="text-sm border rounded p-2">
                {m.nickname}
              </li>
            ))}
          </ul>
        )}
      </section>

      <EquipmentForm />
    </main>
  )
}
