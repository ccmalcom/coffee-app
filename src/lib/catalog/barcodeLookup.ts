import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coffees, roasters } from '@/lib/db/schema'

export type BarcodeLookupResult =
  | {
      source: 'catalog'
      coffeeId: string
      coffeeName: string
      roasterName: string
    }
  | { source: 'open_food_facts'; productName: string; brand: string | null }
  | { source: 'not_found' }

async function lookupOpenFoodFacts(
  barcode: string,
): Promise<BarcodeLookupResult> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: {
          'User-Agent': 'CoffeeApp/1.0 (single-user personal project)',
        },
      },
    )
    if (!res.ok) return { source: 'not_found' }
    const data = await res.json()
    if (data.status !== 1 || !data.product?.product_name)
      return { source: 'not_found' }
    return {
      source: 'open_food_facts',
      productName: data.product.product_name,
      brand: data.product.brands ?? null,
    }
  } catch {
    return { source: 'not_found' }
  }
}

export async function lookupByBarcode(
  barcode: string,
): Promise<BarcodeLookupResult> {
  const catalogRows = await db
    .select({ id: coffees.id, name: coffees.name, roasterName: roasters.name })
    .from(coffees)
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(eq(coffees.barcode, barcode))

  if (catalogRows.length > 0) {
    const row = catalogRows[0]
    return {
      source: 'catalog',
      coffeeId: row.id,
      coffeeName: row.name,
      roasterName: row.roasterName,
    }
  }

  return lookupOpenFoodFacts(barcode)
}
