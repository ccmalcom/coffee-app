// src/lib/parsing/parseListing.ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ParsedListingSchema, type ParsedListing } from './schema'

export class ListingParseError extends Error {}

const SYSTEM_PROMPT = `You extract structured data from specialty coffee bag/listing text.

Process taxonomy (map the listing's own wording onto exactly one of these):
- washed: fully washed / wet process
- natural: natural / dry process / sun-dried
- honey: honey process / pulped natural / miel / white-yellow-red-black honey
- anaerobic: anaerobic fermentation/natural/washed (sealed tank, not nitrogen-specific)
- carbonic_maceration: carbonic maceration / CM process
- nitro_washed: nitro washed / nitrogen-flushed fermentation / N2 washed
- co_ferment: co-ferment / cherry fermented with [fruit] / mosto process
- thermal_shock: thermal shock process/fermentation
- other: anything else — put the roaster's exact phrase in processDetail
- null: the listing doesn't mention a process at all

flavorOrigin:
- 'process': wild/candy-like/intense flavors are attributed to fermentation or processing (default for anaerobic, nitro_washed, carbonic_maceration, co_ferment even when notes sound like candy)
- 'added': listing says the coffee is flavored/flavoring added after roasting (e.g. "hazelnut flavored")
- 'unknown': not enough information to tell

parseConfidence: 'HIGH' if roaster, coffee name, origin, and process are all explicit in the text; 'MEDIUM' if some fields are inferred from partial information; 'LOW' if the text is too sparse to extract most fields confidently.

tastingNotes: lowercase, trimmed short phrases exactly as the roaster wrote them (e.g. "watermelon bubble gum"), not your own paraphrase.

priceCents and sizeGrams: null if not present in the text. Convert dollars to cents (e.g. $24.00 -> 2400) and oz to grams (1 oz = 28.35g, round to nearest gram) if only oz is given.`

async function callOnce(rawText: string) {
  const client = new Anthropic()
  const message = await client.messages.parse({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: rawText }],
    output_config: {
      format: zodOutputFormat(ParsedListingSchema),
    },
  })
  return ParsedListingSchema.safeParse(message.parsed_output)
}

function bestEffortFallback(rawText: string): ParsedListing {
  const firstLine =
    rawText.split('\n').find((l) => l.trim().length > 0) ?? 'Unknown listing'
  return {
    roasterName: firstLine.slice(0, 200),
    roasterWebsite: null,
    coffeeName: firstLine.slice(0, 200),
    originCountry: null,
    originRegion: null,
    producer: null,
    variety: null,
    process: null,
    processDetail: null,
    flavorOrigin: 'unknown',
    tastingNotes: [],
    priceCents: null,
    sizeGrams: null,
    parseConfidence: 'LOW',
  }
}

export async function parseListing(rawText: string): Promise<ParsedListing> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await callOnce(rawText)
      if (result.success) {
        return result.data
      }
      lastError = result.error
    } catch (err) {
      lastError = err
      if (
        err instanceof Error &&
        /api|network|rate.?limit|timeout/i.test(err.message) &&
        attempt === 1
      ) {
        throw new ListingParseError(
          `Anthropic API call failed after retry: ${err.message}`,
        )
      }
    }
  }

  console.warn(
    'parseListing: both attempts failed validation, falling back to LOW-confidence row',
    lastError,
  )
  return bestEffortFallback(rawText)
}
