'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logShot, getDialInState } from '@/lib/actions/shots'
import type { ShotPrefill } from '@/lib/actions/shots'
import type { EquipmentItem } from '@/lib/actions/equipment'
import type { DialInState } from '@/lib/grind/suggestion'
import { DialInCard } from './DialInCard'

const OUTCOME_TAGS = [
  'sour',
  'bitter',
  'weak',
  'harsh',
  'balanced',
  'excellent',
] as const

function toNumber(value: string): number {
  return Number.parseFloat(value)
}

export function ShotForm({
  coffeeId,
  grinders,
  machines,
  prefill,
}: {
  coffeeId: string
  grinders: EquipmentItem[]
  machines: EquipmentItem[]
  prefill: ShotPrefill
}) {
  const router = useRouter()
  const [grinderId, setGrinderId] = useState(prefill?.grinderId ?? grinders[0]?.id ?? '')
  const [machineId, setMachineId] = useState(prefill?.machineId ?? machines[0]?.id ?? '')
  const [dose, setDose] = useState(prefill ? String(prefill.doseGrams) : '')
  const [yieldG, setYieldG] = useState(prefill ? String(prefill.yieldGrams) : '')
  const [time, setTime] = useState('')
  const [macro, setMacro] = useState('')
  const [micro, setMicro] = useState('')
  const [grindText, setGrindText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [dialIn, setDialIn] = useState<DialInState | null>(null)
  const [isPending, startTransition] = useTransition()

  const grinder = grinders.find((g) => g.id === grinderId) ?? null
  const hasMicroDial = grinder?.microStepsPerMacroNotch != null

  // Guard the write path: dose/yield/time must parse to finite numbers, and the
  // grind entry must be present (a finite macro for micro-dial grinders, or any
  // non-empty label for single-dial ones — free text is intentionally allowed
  // there and stored as interpolation-ineligible). Without this, a blank submit
  // writes NaN into the numeric columns and stalls the suggestion engine.
  const grindValid = hasMicroDial
    ? Number.isFinite(toNumber(macro))
    : grindText.trim().length > 0
  const canSubmit =
    !!grinderId &&
    !!machineId &&
    Number.isFinite(toNumber(dose)) &&
    Number.isFinite(toNumber(yieldG)) &&
    Number.isFinite(toNumber(time)) &&
    grindValid

  // Refresh the dial-in card whenever the combo (coffee is fixed) changes.
  useEffect(() => {
    if (!grinderId || !machineId) return
    let cancelled = false
    getDialInState({ coffeeId, grinderId, machineId }).then((state) => {
      if (!cancelled) setDialIn(state)
    })
    return () => {
      cancelled = true
    }
  }, [coffeeId, grinderId, machineId])

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function submit() {
    startTransition(async () => {
      await logShot({
        coffeeId,
        grinderId,
        machineId,
        doseGrams: toNumber(dose),
        yieldGrams: toNumber(yieldG),
        timeSeconds: toNumber(time),
        ...(hasMicroDial
          ? {
              macroInput: toNumber(macro),
              microInput: micro === '' ? 0 : toNumber(micro),
            }
          : { textInput: grindText }),
        outcomeTags: tags,
        note: note || undefined,
      })
      router.push(`/coffee/${coffeeId}`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {dialIn && <DialInCard state={dialIn} />}

      <label className="flex flex-col gap-1 text-sm">
        Grinder
        <select
          value={grinderId}
          onChange={(e) => setGrinderId(e.target.value)}
          className="border rounded p-2"
        >
          {grinders.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Machine
        <select
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          className="border rounded p-2"
        >
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Dose (g)
        <input value={dose} onChange={(e) => setDose(e.target.value)} inputMode="decimal" className="border rounded p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Yield (g)
        <input value={yieldG} onChange={(e) => setYieldG(e.target.value)} inputMode="decimal" className="border rounded p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Time (s)
        <input value={time} onChange={(e) => setTime(e.target.value)} inputMode="decimal" className="border rounded p-2" />
      </label>

      {hasMicroDial ? (
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Grind (macro)
            <input value={macro} onChange={(e) => setMacro(e.target.value)} inputMode="decimal" className="border rounded p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Micro adjust
            <input value={micro} onChange={(e) => setMicro(e.target.value)} inputMode="decimal" className="border rounded p-2" />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Grind setting
          <input value={grindText} onChange={(e) => setGrindText(e.target.value)} className="border rounded p-2" />
        </label>
      )}

      <fieldset className="flex flex-wrap gap-2">
        {OUTCOME_TAGS.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`text-xs rounded-full px-3 py-1 border ${
              tags.includes(tag) ? 'bg-black text-white' : 'bg-white'
            }`}
          >
            {tag}
          </button>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="border rounded p-2" />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !canSubmit}
        className="bg-black text-white rounded p-2 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save shot'}
      </button>
    </div>
  )
}
