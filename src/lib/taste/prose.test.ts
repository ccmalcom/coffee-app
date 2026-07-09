import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TasteProfileData } from './profile'

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

import { generateProfileSummary, ProseGenerationError } from './prose'

const profile: TasteProfileData = {
  version: 1,
  ratedCount: 6,
  clusters: [{ cluster: 'funky_savory', affinity: 1, evidence: '3 of 3 funky-savory coffees rated 4★+' }],
  processes: [{ process: 'natural', affinity: 1, evidence: 'rated 3 of 3 natural coffees 4★+' }],
  summary: '',
}

describe('generateProfileSummary', () => {
  beforeEach(() => createMock.mockReset())

  it('returns the model text for the computed profile', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'You gravitate to funky naturals.' }],
    })
    const out = await generateProfileSummary(profile, ['insane strawberry'])
    expect(out).toBe('You gravitate to funky naturals.')
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('throws ProseGenerationError when the API call fails', async () => {
    // mockRejectedValue triggers a Vitest 4.1.10 unhandled-rejection false
    // positive here; mockImplementationOnce defers promise creation to the
    // actual call site, which the awaited catch handles in time.
    createMock.mockImplementationOnce(() => Promise.reject(new Error('network')))
    await expect(generateProfileSummary(profile, [])).rejects.toBeInstanceOf(ProseGenerationError)
  })

  it('throws ProseGenerationError when the model returns no text', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'tool_use' }] })
    await expect(generateProfileSummary(profile, [])).rejects.toBeInstanceOf(ProseGenerationError)
  })
})
