import Anthropic from '@anthropic-ai/sdk'
import type { TasteProfileData } from './profile'

export class ProseGenerationError extends Error {}

// Phrasing already-computed facts is a small task — a cheap, fast model suffices.
export const PROSE_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You write a short, friendly 2-3 sentence summary of a coffee drinker's taste profile.
You are given already-computed flavor-cluster and process preferences with evidence, plus optional review snippets.
Rules:
- Phrase ONLY what you're given. Do not invent flavors, clusters, numbers, or preferences that are not in the data.
- Do not restate the raw numbers; describe the preferences in plain language.
- You may lightly reference the review snippets as color. Keep it to 2-3 sentences.`

type Textish = { type: string; text?: string }

export async function generateProfileSummary(
  profile: TasteProfileData,
  reviewSnippets: string[],
): Promise<string> {
  const topClusters = profile.clusters
    .slice(0, 5)
    .map((c) => `${c.cluster.replace(/_/g, '-')} (${c.evidence})`)
  const topProcesses = profile.processes
    .slice(0, 5)
    .map((p) => `${p.process} (${p.evidence})`)

  const userContent = [
    `Flavor clusters they gravitate to: ${topClusters.length ? topClusters.join('; ') : 'none yet'}`,
    `Preferred processes: ${topProcesses.length ? topProcesses.join('; ') : 'none yet'}`,
    reviewSnippets.length
      ? `Review snippets: ${reviewSnippets.map((r) => `"${r}"`).join(' ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: PROSE_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
    const text = (message.content as Textish[])
      .map((b) => (b.type === 'text' ? (b.text ?? '') : ''))
      .join('')
      .trim()
    if (!text) throw new ProseGenerationError('model returned no text')
    return text
  } catch (err) {
    if (err instanceof ProseGenerationError) throw err
    throw new ProseGenerationError(
      err instanceof Error ? err.message : 'unknown prose error',
    )
  }
}
