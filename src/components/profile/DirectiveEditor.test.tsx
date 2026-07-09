import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DirectiveView } from '@/lib/actions/taste'

const { saveDirectiveMock } = vi.hoisted(() => ({ saveDirectiveMock: vi.fn() }))
vi.mock('@/lib/actions/taste', () => ({ saveDirective: saveDirectiveMock }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { DirectiveEditor } from './DirectiveEditor'

const empty: DirectiveView = { goals: [], freeText: null, excludeAddedFlavor: true }

describe('DirectiveEditor', () => {
  beforeEach(() => saveDirectiveMock.mockReset())

  it('reflects the current directive (exclude toggle pre-checked)', () => {
    render(<DirectiveEditor directive={{ goals: ['daily_drinkers'], freeText: 'more fruit', excludeAddedFlavor: true }} />)
    expect(screen.getByLabelText(/find reliable daily drinkers/i)).toBeChecked()
    expect(screen.getByLabelText(/exclude added-flavor/i)).toBeChecked()
    expect(screen.getByDisplayValue('more fruit')).toBeInTheDocument()
  })

  it('saves the selected goals, free text, and toggle', async () => {
    saveDirectiveMock.mockResolvedValue(undefined)
    render(<DirectiveEditor directive={empty} />)
    await userEvent.click(screen.getByLabelText(/discover wild process-driven flavors/i))
    await userEvent.type(screen.getByLabelText(/anything else/i), 'lychee please')
    await userEvent.click(screen.getByLabelText(/exclude added-flavor/i)) // true -> false
    await userEvent.click(screen.getByRole('button', { name: /save goals/i }))
    expect(saveDirectiveMock).toHaveBeenCalledWith({
      goals: ['wild_process'],
      freeText: 'lychee please',
      excludeAddedFlavor: false,
    })
  })

  it('surfaces an error when saving fails', async () => {
    saveDirectiveMock.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    render(<DirectiveEditor directive={empty} />)
    await userEvent.click(screen.getByRole('button', { name: /save goals/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i)
  })
})
