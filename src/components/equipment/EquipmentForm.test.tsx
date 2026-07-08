import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { createEquipmentMock } = vi.hoisted(() => ({
  createEquipmentMock: vi.fn().mockResolvedValue({ id: 'eq-1' }),
}))
vi.mock('@/lib/actions/equipment', () => ({
  createEquipment: createEquipmentMock,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import { EquipmentForm } from './EquipmentForm'

describe('EquipmentForm', () => {
  beforeEach(() => createEquipmentMock.mockClear())

  it('hides the micro-steps input until the micro-dial toggle is checked', async () => {
    render(<EquipmentForm />)
    expect(screen.queryByLabelText(/micro steps per macro notch/i)).toBeNull()
    await userEvent.click(screen.getByLabelText(/secondary\/micro adjustment/i))
    const input = screen.getByLabelText(/micro steps per macro notch/i)
    expect(input).toHaveValue(6) // DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH
  })

  it('does not offer the micro-dial toggle when kind is machine', async () => {
    render(<EquipmentForm />)
    await userEvent.selectOptions(screen.getByLabelText(/type/i), 'machine')
    expect(screen.queryByLabelText(/secondary\/micro adjustment/i)).toBeNull()
  })

  it('submits a grinder with the configured micro-steps constant', async () => {
    render(<EquipmentForm />)
    await userEvent.type(screen.getByLabelText(/nickname/i), 'Daily driver')
    await userEvent.click(screen.getByLabelText(/secondary\/micro adjustment/i))
    await userEvent.click(screen.getByRole('button', { name: /add equipment/i }))
    expect(createEquipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'grinder',
        nickname: 'Daily driver',
        microStepsPerMacroNotch: 6,
      }),
    )
  })
})
