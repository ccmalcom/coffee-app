import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EquipmentItem } from '@/lib/actions/equipment'

const { logShotMock, getDialInStateMock } = vi.hoisted(() => ({
  logShotMock: vi.fn().mockResolvedValue({ id: 'shot-1' }),
  getDialInStateMock: vi
    .fn()
    .mockResolvedValue({ kind: 'new_bag', baseline: { status: 'insufficient_history', shotsLogged: 0, shotsNeeded: 15 } }),
}))
vi.mock('@/lib/actions/shots', () => ({
  logShot: logShotMock,
  getDialInState: getDialInStateMock,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ShotForm } from './ShotForm'

const machine: EquipmentItem = {
  id: 'machine-1',
  kind: 'machine',
  nickname: 'Silvia',
  brand: null,
  model: null,
  microStepsPerMacroNotch: null,
}
const microGrinder: EquipmentItem = {
  id: 'grinder-micro',
  kind: 'grinder',
  nickname: 'Micro dialed',
  brand: null,
  model: null,
  microStepsPerMacroNotch: 6,
}
const singleGrinder: EquipmentItem = {
  id: 'grinder-single',
  kind: 'grinder',
  nickname: 'Single dial',
  brand: null,
  model: null,
  microStepsPerMacroNotch: null,
}

describe('ShotForm', () => {
  beforeEach(() => {
    logShotMock.mockClear()
    getDialInStateMock.mockClear()
  })

  it('renders one grind field for a single-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[singleGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    expect(screen.getByLabelText(/^grind setting$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/micro adjust/i)).toBeNull()
  })

  it('renders macro + micro fields for a micro-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[microGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    expect(screen.getByLabelText(/grind \(macro\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/micro adjust/i)).toBeInTheDocument()
  })

  it('submits macro/micro values for a micro-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[microGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    await userEvent.type(screen.getByLabelText(/dose/i), '18')
    await userEvent.type(screen.getByLabelText(/yield/i), '36')
    await userEvent.type(screen.getByLabelText(/time/i), '28')
    await userEvent.type(screen.getByLabelText(/grind \(macro\)/i), '12')
    await userEvent.type(screen.getByLabelText(/micro adjust/i), '-2')
    await userEvent.click(screen.getByRole('button', { name: /save shot/i }))

    expect(logShotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coffeeId: 'coffee-1',
        grinderId: 'grinder-micro',
        machineId: 'machine-1',
        doseGrams: 18,
        yieldGrams: 36,
        timeSeconds: 28,
        macroInput: 12,
        microInput: -2,
      }),
    )
  })

  it('submits a free-text grind setting for a single-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[singleGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    await userEvent.type(screen.getByLabelText(/dose/i), '18')
    await userEvent.type(screen.getByLabelText(/yield/i), '36')
    await userEvent.type(screen.getByLabelText(/time/i), '28')
    await userEvent.type(screen.getByLabelText(/^grind setting$/i), 'medium-fine')
    await userEvent.click(screen.getByRole('button', { name: /save shot/i }))

    expect(logShotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        grinderId: 'grinder-single',
        textInput: 'medium-fine',
      }),
    )
  })
})
