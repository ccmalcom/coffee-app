'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEquipment, type EquipmentKind } from '@/lib/actions/equipment'
import { DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH } from '@/lib/grind/constants'

export function EquipmentForm() {
  const router = useRouter()
  const [kind, setKind] = useState<EquipmentKind>('grinder')
  const [nickname, setNickname] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [hasMicroDial, setHasMicroDial] = useState(false)
  const [microSteps, setMicroSteps] = useState(DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH)
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      await createEquipment({
        kind,
        nickname,
        brand: brand || undefined,
        model: model || undefined,
        microStepsPerMacroNotch:
          kind === 'grinder' && hasMicroDial ? microSteps : null,
      })
      setNickname('')
      setBrand('')
      setModel('')
      setHasMicroDial(false)
      setMicroSteps(DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-surface-raised p-4">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EquipmentKind)}
          className="rounded border border-surface-raised bg-surface p-2"
        >
          <option value="grinder">Grinder</option>
          <option value="machine">Machine</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nickname
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Brand (optional)
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Model (optional)
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      {kind === 'grinder' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasMicroDial}
            onChange={(e) => setHasMicroDial(e.target.checked)}
            className="accent-accent"
          />
          Has a secondary/micro adjustment?
        </label>
      )}

      {kind === 'grinder' && hasMicroDial && (
        <label className="flex flex-col gap-1 text-sm">
          Micro steps per macro notch
          <input
            type="number"
            value={microSteps}
            onChange={(e) => setMicroSteps(Number(e.target.value))}
            className="rounded border border-surface-raised bg-surface p-2"
          />
        </label>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || nickname.trim().length === 0}
        className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add equipment'}
      </button>
    </div>
  )
}
