import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgSchema,
  uuid,
  text,
  varchar,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { coffees } from './catalog'

// Supabase manages this table; we only need a typed reference for FKs.
const authSchema = pgSchema('auth')
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

export const libraryStatusEnum = pgEnum('library_status', [
  'candidate',
  'wishlist',
  'owned',
  'finished',
])

export const equipmentKindEnum = pgEnum('equipment_kind', [
  'grinder',
  'machine',
])

export const shotOutcomeTagEnum = pgEnum('shot_outcome_tag', [
  'sour',
  'bitter',
  'weak',
  'harsh',
  'balanced',
  'excellent',
])

export const discoveryRunTypeEnum = pgEnum('discovery_run_type', [
  'roaster_check',
  'web_search',
])

export const libraryEntries = pgTable('library_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  coffeeId: uuid('coffee_id')
    .notNull()
    .references(() => coffees.id),
  status: libraryStatusEnum('status').notNull().default('candidate'),
  rating: integer('rating'),
  review: text('review'),
  discoveryScore: real('discovery_score'),
  discoveryExplanation: text('discovery_explanation'),
  discoveredInRunId: uuid('discovered_in_run_id'),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  kind: equipmentKindEnum('kind').notNull(),
  brand: text('brand'),
  model: text('model'),
  nickname: text('nickname').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  coffeeId: uuid('coffee_id')
    .notNull()
    .references(() => coffees.id),
  grinderId: uuid('grinder_id')
    .notNull()
    .references(() => equipment.id),
  machineId: uuid('machine_id')
    .notNull()
    .references(() => equipment.id),
  method: varchar('method', { length: 32 }).notNull().default('espresso'),
  doseGrams: real('dose_g').notNull(),
  yieldGrams: real('yield_g').notNull(),
  timeSeconds: real('time_s').notNull(),
  grindSetting: text('grind_setting').notNull(),
  outcomeTags: shotOutcomeTagEnum('outcome_tags')
    .array()
    .notNull()
    .default(sql`'{}'::shot_outcome_tag[]`),
  note: text('note'),
  rating: integer('rating'),
  brewedAt: timestamp('brewed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const tasteProfile = pgTable('taste_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
  profile: jsonb('profile').notNull(),
  stale: boolean('stale').notNull().default(false),
})

export const directives = pgTable('directives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => authUsers.id),
  goals: text('goals')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  freeText: text('free_text'),
  excludeAddedFlavor: boolean('exclude_added_flavor').notNull().default(true),
  editedAt: timestamp('edited_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const discoveryRuns = pgTable('discovery_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: discoveryRunTypeEnum('type').notNull(),
  source: text('source'),
  candidatesFound: integer('candidates_found').notNull().default(0),
  candidatesCreated: integer('candidates_created').notNull().default(0),
  errors: jsonb('errors'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})
