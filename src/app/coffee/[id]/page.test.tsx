import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { getCoffeeDetailMock, listShotsForCoffeeMock, listCoffeeDialInsMock } = vi.hoisted(
  () => ({
    getCoffeeDetailMock: vi.fn(),
    listShotsForCoffeeMock: vi.fn(),
    listCoffeeDialInsMock: vi.fn(),
  }),
)

vi.mock('@/lib/actions/coffee', () => ({ getCoffeeDetail: getCoffeeDetailMock }))
vi.mock('@/lib/actions/shots', () => ({
  listShotsForCoffee: listShotsForCoffeeMock,
  listCoffeeDialIns: listCoffeeDialInsMock,
}))
vi.mock('@/components/coffee/RateReviewForm', () => ({
  RateReviewForm: () => null,
}))

import CoffeeDetailPage from './page'

describe('CoffeeDetailPage shot sections', () => {
  beforeEach(() => {
    getCoffeeDetailMock.mockResolvedValue({
      id: 'coffee-1',
      name: 'Test Coffee',
      roasterName: 'Test Roaster',
      originCountry: null,
      originRegion: null,
      producer: null,
      variety: null,
      process: null,
      processDetail: null,
      tastingNotes: [],
      rating: null,
      review: null,
      status: 'owned',
    })
    listCoffeeDialInsMock.mockResolvedValue([])
  })

  it('renders logged shots and a Log-shot link', async () => {
    listShotsForCoffeeMock.mockResolvedValue([
      {
        id: 'shot-1',
        grinderNickname: 'Daily driver',
        machineNickname: 'Silvia',
        doseGrams: 18,
        yieldGrams: 36,
        timeSeconds: 28,
        grindSetting: '12 / -2',
        outcomeTags: ['balanced'],
        rating: null,
        note: null,
        brewedAt: '2026-07-07T00:00:00.000Z',
      },
    ])
    const ui = await CoffeeDetailPage({ params: Promise.resolve({ id: 'coffee-1' }) })
    render(ui)
    expect(screen.getByText('12 / -2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /log shot/i })).toHaveAttribute(
      'href',
      '/coffee/coffee-1/log',
    )
  })

  it('shows an empty-state when there are no shots', async () => {
    listShotsForCoffeeMock.mockResolvedValue([])
    const ui = await CoffeeDetailPage({ params: Promise.resolve({ id: 'coffee-1' }) })
    render(ui)
    expect(screen.getByText(/no shots logged yet/i)).toBeInTheDocument()
  })
})
