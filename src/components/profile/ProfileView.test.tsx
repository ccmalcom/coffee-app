import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProfileView as ProfileViewData } from '@/lib/actions/taste'

const { rebuildProfileMock } = vi.hoisted(() => ({ rebuildProfileMock: vi.fn() }))
vi.mock('@/lib/actions/taste', () => ({ rebuildProfile: rebuildProfileMock }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { ProfileView } from './ProfileView'

const fresh: ProfileViewData = {
  state: 'fresh',
  ratedCount: 6,
  builtAt: '2026-02-01T00:00:00Z',
  newRatingsSince: 0,
  profile: {
    version: 1,
    ratedCount: 6,
    clusters: [{ cluster: 'fruit_candied', affinity: 1, evidence: '2 of 2 fruit-candied coffees rated 4★+' }],
    processes: [{ process: 'anaerobic', affinity: 1, evidence: 'rated 2 of 2 anaerobic coffees 4★+' }],
    summary: 'You gravitate to wild fruit-candied naturals.',
  },
}

describe('ProfileView', () => {
  beforeEach(() => rebuildProfileMock.mockReset())

  it('prompts to rate more coffees in cold start', () => {
    render(<ProfileView view={{ state: 'cold_start', ratedCount: 2, builtAt: null, newRatingsSince: 0, profile: null }} />)
    expect(screen.getByText(/2 of 5/)).toBeInTheDocument()
  })

  it('offers a build CTA when never built', async () => {
    rebuildProfileMock.mockResolvedValue({})
    render(<ProfileView view={{ state: 'never_built', ratedCount: 6, builtAt: null, newRatingsSince: 0, profile: null }} />)
    await userEvent.click(screen.getByRole('button', { name: /build your profile/i }))
    expect(rebuildProfileMock).toHaveBeenCalledOnce()
  })

  it('renders clusters, processes, evidence, and the summary when fresh', () => {
    render(<ProfileView view={fresh} />)
    expect(screen.getByText('You gravitate to wild fruit-candied naturals.')).toBeInTheDocument()
    expect(screen.getByText('fruit-candied')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 fruit-candied coffees rated 4★+')).toBeInTheDocument()
    expect(screen.getByText('anaerobic')).toBeInTheDocument()
  })

  it('shows a stale banner with a rebuild button', async () => {
    rebuildProfileMock.mockResolvedValue({})
    render(<ProfileView view={{ ...fresh, state: 'stale', newRatingsSince: 3 }} />)
    expect(screen.getByText(/3 new ratings since last build/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /rebuild profile/i }))
    expect(rebuildProfileMock).toHaveBeenCalledOnce()
  })

  it('surfaces an error when rebuild fails', async () => {
    rebuildProfileMock.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    render(<ProfileView view={{ ...fresh, state: 'stale', newRatingsSince: 1 }} />)
    await userEvent.click(screen.getByRole('button', { name: /rebuild profile/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i)
  })
})
