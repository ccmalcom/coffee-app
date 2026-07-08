import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'

export const addedViaEnum = pgEnum('added_via', ['manual', 'discovery'])

export const processEnum = pgEnum('process', [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic_maceration',
  'nitro_washed',
  'co_ferment',
  'thermal_shock',
  'other',
])

export const flavorOriginEnum = pgEnum('flavor_origin', [
  'process',
  'added',
  'unknown',
])

export const parseConfidenceEnum = pgEnum('parse_confidence', [
  'HIGH',
  'MEDIUM',
  'LOW',
])

export const roasters = pgTable('roasters', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  website: text('website'),
  location: text('location'),
  watched: boolean('watched').notNull().default(false),
  addedVia: addedViaEnum('added_via').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const coffees = pgTable('coffees', {
  id: uuid('id').primaryKey().defaultRandom(),
  roasterId: uuid('roaster_id')
    .notNull()
    .references(() => roasters.id),
  name: text('name').notNull(),
  originCountry: text('origin_country'),
  originRegion: text('origin_region'),
  producer: text('producer'),
  variety: text('variety'),
  process: processEnum('process'),
  processDetail: text('process_detail'),
  flavorOrigin: flavorOriginEnum('flavor_origin').notNull().default('unknown'),
  tastingNotes: text('tasting_notes')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  rawListingText: text('raw_listing_text'),
  listingUrl: text('listing_url').unique(),
  barcode: varchar('barcode', { length: 64 }).unique(),
  priceCents: integer('price_cents'),
  sizeGrams: integer('size_grams'),
  parseConfidence: parseConfidenceEnum('parse_confidence')
    .notNull()
    .default('LOW'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
