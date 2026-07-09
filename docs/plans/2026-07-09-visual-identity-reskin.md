# Visual Identity Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app one deliberate "third-wave cafe at night" visual identity — a single committed dark warm theme with real typography — replacing the unstyled Tailwind defaults every screen has used since Plan 1, and fixing the font-override and dark-mode contrast bugs that fall out of that.

**Architecture:** Define a palette + type token layer once in `globals.css` (Tailwind v4 CSS-first `@theme`) and wire Fraunces + Karla via `next/font/google` in `layout.tsx`. Then mechanically re-skin every screen to consume those tokens (`bg-surface`, `text-accent`, `font-display`, etc.). This is a pure re-skin: no layout, IA, routing, data, or component-prop changes. No new runtime logic, so no new unit tests — verification is "existing suite stays green" + a live browser walkthrough per screen (the same method Plan 3 used).

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (CSS-first `@theme`), `next/font/google` (Fraunces + Karla), React 19, Vitest + Testing Library (existing suite only).

**Source spec:** `docs/specs/2026-07-09-visual-identity-design.md` — read it first; it carries the design rationale and the computed contrast table this plan implements.

## Global Constraints

Every task's requirements implicitly include this section. Copy exact values verbatim.

**Palette tokens (define once in `globals.css`, Task 1; all later tasks consume the generated utilities):**

| Token | Hex | Generated utilities used |
|---|---|---|
| `--color-bg` | `#1E1812` | `bg-bg`, `text-bg` (near-black button text), `border-bg` |
| `--color-surface` | `#2B2219` | `bg-surface` |
| `--color-surface-raised` | `#3D3226` | `bg-surface-raised`, `border-surface-raised` |
| `--color-text` | `#EDE3D3` | `text-text` (rarely needed — it's the inherited default) |
| `--color-text-muted` | `#A99A87` | `text-text-muted` |
| `--color-accent` | `#C97C4B` | `bg-accent`, `text-accent`, `border-accent` |
| `--color-accent-hover` | `#BE7345` | `hover:bg-accent-hover` |
| `--color-danger` | `#D2684A` | `text-danger` |
| `--color-success` | `#8FA06B` | `text-success` |

**`--color-accent-hover` is `#BE7345`, NOT the `#B36A3D` drafted in the spec.** The spec explicitly pre-authorized re-checking and nudging this value at implementation time. Computed: `#B36A3D` as a button background with `bg`-colored (`#1E1812`) text is only 4.22:1 (below the 4.5:1 AA floor for normal text). `#BE7345` is 4.79:1 — passes, and is still darker than the base accent so it reads as a conventional darken-on-hover. Use `#BE7345`.

**Typography tokens:** `--font-sans: var(--font-karla)` (default body font, app-wide), `--font-display: var(--font-fraunces)` (`font-display` utility, for the page `<h1>` on each screen and large hero text). Both loaded via `next/font/google` in `layout.tsx`. The dead `--font-geist-sans` / `--font-geist-mono` references and the hardcoded `Arial, Helvetica` body override are removed.

**Surface / input / card system (apply consistently everywhere):**
- **Page background:** inherited from `body` (`bg`). `<main>` elements set no background.
- **Content cards** (contain only text — e.g. `CoffeeCard`, shot-history rows, equipment rows, the barcode catalog-hit card): `bg-surface` fill + `border border-surface-raised`.
- **Form-wrapping containers** (contain nested inputs — e.g. the `EquipmentForm` card): **outline only** — `border border-surface-raised`, **no** `bg-*` fill — so the `surface`-filled inputs inside them stay visible against the darker page `bg` showing through.
- **Inputs / selects / textareas:** `bg-surface border border-surface-raised`. Add `placeholder:text-text-muted` wherever the field has a `placeholder`. Add `accent-accent` to every `<input type="checkbox">` so the native check uses the terracotta accent.

**Button rule:** Primary buttons and active toggle/tab states use `bg-accent text-bg font-medium` with `hover:bg-accent-hover`. The text is `bg`-colored (near-black), never `text`-colored (cream) — cream-on-terracotta is only 2.6:1. Keep any existing `disabled:opacity-50`.

**Signature chip:** the shared `Chip` component (created in Task 2) is the ONLY treatment for coffee-detail tasting notes and Profile flavor-cluster labels. Thin `accent` border + `surface-raised` fill. Do not restyle these as plain pills.

**Contrast is a hard floor:** WCAG AA — 4.5:1 for normal text, 3:1 for large/bold text — verified as text-on-its-actual-background. Do not put `text-text-muted` on a `surface-raised` background as the *primary* readable line (that pairing is only 4.55:1 — reserve it for genuinely secondary text; banner body text uses the default `text` color). No pure black or pure white anywhere.

**No logic changes:** touch only `className` strings, JSX wrapper elements, and the font/token setup. Do not change component props, exported signatures, server-action calls, state, or control flow. The one deliberate exceptions are (a) `NavBar` gains `usePathname()` for active-route styling (Task 2) and (b) the Profile process label gains a `.replace(/_/g, '-')` format (Task 8) — both called out explicitly in their tasks.

**Testing:** No new unit tests (styling only). Each task runs `npm run test:run` and expects the **existing** suite to stay green (currently ~71 tests), plus `npx tsc --noEmit` clean, plus a live browser check of the task's screen(s). No existing test asserts on `className` or on any text this plan changes — confirmed before writing this plan. If a task makes an existing test fail, that is a real regression to fix, not a test to update.

**Commits:** one commit per task, frequent and scoped. No `Co-Authored-By` / attribution trailers (project rule).

**Browser verification (every task that renders a screen):** with `npm run dev` running, use the Claude-in-Chrome tools to load each listed route and confirm: (1) legible text everywhere — no near-invisible low-contrast text; (2) the accent (terracotta) appears only on intended elements; (3) fonts render (Karla body, Fraunces headings); (4) no console errors. Note anything off in the task report.

---

### Task 1: Design tokens + typography foundation

**Files:**
- Modify: `src/app/globals.css` (replace tokens, remove media query + light `:root` + Arial override)
- Modify: `src/app/layout.tsx` (wire `next/font/google` Fraunces + Karla; apply font variables to `<html>`; update `themeColor`)

**Interfaces:**
- Consumes: nothing.
- Produces: the `bg-*` / `text-*` / `border-*` color utilities and the `font-display` utility that every later task uses; app-wide dark `bg` + Karla base font.

- [ ] **Step 1: Replace `src/app/globals.css` with the token layer**

```css
@import 'tailwindcss';

@theme {
  --color-bg: #1E1812;
  --color-surface: #2B2219;
  --color-surface-raised: #3D3226;
  --color-text: #EDE3D3;
  --color-text-muted: #A99A87;
  --color-accent: #C97C4B;
  --color-accent-hover: #BE7345;
  --color-danger: #D2684A;
  --color-success: #8FA06B;
}

@theme inline {
  --font-sans: var(--font-karla);
  --font-display: var(--font-fraunces);
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

Notes: the color tokens go in a plain `@theme` block (literal hex → Tailwind generates `bg-bg`, `text-accent`, `border-surface-raised`, etc.). The font tokens go in `@theme inline` because they reference the runtime `--font-karla` / `--font-fraunces` variables that `next/font` injects on `<html>` — `inline` makes the `font-sans` / `font-display` utilities emit `var(--font-…)` directly instead of resolving at build time. Setting `--font-sans` makes Karla the default `font-family` app-wide via Tailwind's preflight. The old `prefers-color-scheme` block, the light `:root` values, the dead `--font-geist-*` references, and the `font-family: Arial, Helvetica` override are all gone.

- [ ] **Step 2: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Fraunces, Karla } from 'next/font/google'
import { NavBar } from '@/components/layout/NavBar'
import './globals.css'

const APP_NAME = 'Coffee App'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const karla = Karla({
  subsets: ['latin'],
  variable: '--font-karla',
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s - ${APP_NAME}` },
  description: 'Personal espresso coffee log, grind dial-in, and discovery.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#1E1812',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="pb-16 md:pb-0">
        <NavBar />
        {children}
      </body>
    </html>
  )
}
```

Only changes vs. current: the two `next/font/google` imports + font consts, `themeColor` updated `#1c1917` → `#1E1812`, and the `<html>` gains `className={...}` with the two font variables. Everything else is byte-identical.

- [ ] **Step 3: Verify the build compiles and fonts resolve**

Run: `npm run build`
Expected: build succeeds. `next/font` fetches Fraunces + Karla from Google Fonts at build time (network required — same network these deps were installed over). If the build fails on font fetch, that's an environment/network issue to surface, not a code error.

- [ ] **Step 4: Verify the existing test suite still passes**

Run: `npm run test:run`
Expected: same pass count as before this task (~71 passing), zero failures. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Browser-verify the base theme**

Start `npm run dev`, load `http://localhost:3000/library` in Chrome. Confirm: page background is the dark warm brown (`#1E1812`), body text is the parchment cream and rendered in Karla (not Arial/Times), no console errors. (The NavBar is still mid-re-skin here — just confirm the page background/font, not the nav yet.)

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): dark warm theme tokens + Fraunces/Karla fonts"
```

---

### Task 2: App shell — NavBar + shared Chip primitive

**Files:**
- Modify: `src/components/layout/NavBar.tsx` (convert to client component for active-route styling; re-skin)
- Create: `src/components/ui/Chip.tsx` (the signature stamped tasting-note/cluster chip)

**Interfaces:**
- Consumes: color utilities from Task 1.
- Produces: `Chip` — `import { Chip } from '@/components/ui/Chip'`, used as `<Chip>{text}</Chip>`. Signature: `export function Chip({ children }: { children: ReactNode })`. Consumed by Task 5 (tasting notes) and Task 8 (cluster labels).

- [ ] **Step 1: Create `src/components/ui/Chip.tsx`**

```tsx
import type { ReactNode } from 'react'

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent bg-surface-raised px-2 py-0.5 text-xs text-text">
      {children}
    </span>
  )
}
```

- [ ] **Step 2: Replace `src/components/layout/NavBar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/library', label: 'Library' },
  { href: '/coffee/add', label: 'Add' },
  { href: '/equipment', label: 'Equipment' },
  { href: '/profile', label: 'Profile' },
] as const

export function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-surface-raised bg-surface py-2 md:static md:justify-start md:gap-6 md:border-t-0 md:border-b md:px-4">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm ${active ? 'text-accent' : 'text-text-muted'}`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

Rationale: NavBar had no active state at all (every link identical) and a hardcoded `bg-white` — the root of the "white text on white" bug on every page. It now needs `usePathname()`, which requires `'use client'`. This is a styling-state addition, not an IA change (same links, same routes, same order). `bg-surface` fixes the invisible-nav bug; active route = `text-accent`, inactive = `text-text-muted`.

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit` → clean. Then `npm run test:run` → existing suite still green.

- [ ] **Step 4: Browser-verify the nav on every route**

With `npm run dev` running, load `/library`, `/coffee/add`, `/equipment`, `/profile`. Confirm on each: the nav bar has the `surface` (dark) background and is fully legible (no white bar, no invisible text); the link matching the current route is terracotta (`accent`), the others are muted. Confirm the nav is fixed-bottom on a narrow viewport and top/static on a wide one (unchanged responsive behavior).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Chip.tsx src/components/layout/NavBar.tsx
git commit -m "feat(ui): re-skin NavBar (surface bg, active accent) + Chip primitive"
```

---

### Task 3: Library screen — page + CoffeeCard + RatingStars

**Files:**
- Modify: `src/app/library/page.tsx`
- Modify: `src/components/coffee/CoffeeCard.tsx`
- Modify: `src/components/coffee/RatingStars.tsx`

**Interfaces:**
- Consumes: color/`font-display` utilities from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace `src/app/library/page.tsx`**

```tsx
import Link from 'next/link'
import { listLibrary } from '@/lib/actions/coffee'
import { CoffeeCard } from '@/components/coffee/CoffeeCard'

// 'wishlist' and 'finished' are omitted for now: no UI path sets those statuses yet
// (that's Plan 2/3's job), so showing them here would just be permanently-empty dead tabs.
// Re-add them once status-changing UI exists — the tab loop below is already generic over TABS.
const TABS = ['owned'] as const

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = (TABS as readonly string[]).includes(tab ?? '')
    ? (tab as (typeof TABS)[number])
    : 'owned'

  const entries = await listLibrary(activeTab)

  return (
    <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-display font-semibold">Library</h1>
        <Link
          href="/coffee/add"
          className="rounded bg-accent px-3 py-1 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          + Add coffee
        </Link>
      </div>

      <div className="flex gap-4 border-b border-surface-raised">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/library?tab=${t}`}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm capitalize ${
              activeTab === t
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-text-muted text-sm">No coffees here yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <CoffeeCard key={entry.entryId} entry={entry} />
          ))}
        </div>
      )}
    </main>
  )
}
```

Changes: `h1` gains `font-display`; the Add button becomes an accent button (`bg-accent text-bg … hover:bg-accent-hover`); tabs become an underline row (active = `accent` underline + `text`, inactive = `text-muted`, no `bg-gray-200` block); empty-state `text-gray-500` → `text-text-muted`.

- [ ] **Step 2: Replace `src/components/coffee/CoffeeCard.tsx`**

```tsx
import Link from 'next/link'
import { RatingStars } from './RatingStars'
import type { LibraryEntryWithCoffee } from '@/lib/actions/coffee'

export function CoffeeCard({ entry }: { entry: LibraryEntryWithCoffee }) {
  return (
    <Link
      href={`/coffee/${entry.coffeeId}`}
      className="block rounded border border-surface-raised bg-surface p-3 hover:bg-surface-raised"
    >
      <p className="text-sm text-text-muted">{entry.roasterName}</p>
      <p className="font-medium">{entry.coffeeName}</p>
      <RatingStars value={entry.rating} readOnly />
    </Link>
  )
}
```

Changes: content-card treatment (`bg-surface border border-surface-raised`, hover to `surface-raised`); roaster line `text-gray-500` → `text-text-muted`. Coffee name stays `font-medium` (body Karla) — it's a small list item; the display serif is reserved for the large detail-page heading.

- [ ] **Step 3: Replace `src/components/coffee/RatingStars.tsx`**

```tsx
'use client'

export function RatingStars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null
  onChange?: (rating: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={`text-2xl ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            value && star <= value ? 'text-accent' : 'text-surface-raised'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
```

Changes only: filled star `text-yellow-500` → `text-accent`; empty star `text-gray-300` → `text-surface-raised` (a dim, decorative empty state — no text-contrast requirement). Logic/props untouched.

- [ ] **Step 4: Verify types + tests**

Run: `npx tsc --noEmit` → clean. `npm run test:run` → existing suite green (`coffee.test.ts` and others unaffected).

- [ ] **Step 5: Browser-verify the Library screen**

Load `/library`. Confirm: heading in Fraunces; "+ Add coffee" is a terracotta button with dark legible text and darkens on hover; the "owned" tab shows an accent underline; coffee cards are dark `surface` panels with muted roaster text, a legible name, and terracotta filled stars / dim empty stars; hovering a card lifts it to `surface-raised`. If the library is empty, confirm the empty-state line is legible muted text.

- [ ] **Step 6: Commit**

```bash
git add src/app/library/page.tsx src/components/coffee/CoffeeCard.tsx src/components/coffee/RatingStars.tsx
git commit -m "feat(ui): re-skin Library screen (tabs, cards, stars, add button)"
```

---

### Task 4: Add-coffee flow — page + AddCoffeeForm + BarcodeScanner

**Files:**
- Modify: `src/app/coffee/add/page.tsx`
- Modify: `src/components/coffee/AddCoffeeForm.tsx`
- Modify: `src/components/coffee/BarcodeScanner.tsx`

**Interfaces:**
- Consumes: color/`font-display` utilities from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace `src/app/coffee/add/page.tsx`**

```tsx
import { AddCoffeeForm } from '@/components/coffee/AddCoffeeForm'

export default function AddCoffeePage() {
  return (
    <main>
      <h1 className="text-xl font-display font-semibold text-center mt-4">Add a coffee</h1>
      <AddCoffeeForm />
    </main>
  )
}
```

Change only: `h1` gains `font-display`.

- [ ] **Step 2: Replace `src/components/coffee/AddCoffeeForm.tsx`**

Keep the entire component logic (imports, types, all handlers, state) exactly as-is. Only the `return (...)` JSX `className`s change. Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addCoffeeFromListing,
  addCoffeeFromBarcode,
  confirmBarcodeCoffee,
} from '@/lib/actions/coffee'
import { BarcodeScanner } from './BarcodeScanner'

type Mode = 'paste' | 'scan'
type BarcodeState =
  | { step: 'idle' }
  | {
      step: 'catalog_hit'
      coffeeName: string
      roasterName: string
      coffeeId: string
    }
  | {
      step: 'off_hit'
      barcode: string
      productName: string
      brand: string | null
    }
  | { step: 'not_found'; barcode: string }

export function AddCoffeeForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('paste')
  const [rawText, setRawText] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [barcodeState, setBarcodeState] = useState<BarcodeState>({
    step: 'idle',
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePasteSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await addCoffeeFromListing({
          rawText,
          listingUrl: listingUrl || undefined,
        })
        router.push(`/coffee/${result.coffeeId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleBarcodeDetected(barcode: string) {
    startTransition(async () => {
      const result = await addCoffeeFromBarcode(barcode)
      if (result.source === 'catalog') {
        setBarcodeState({
          step: 'catalog_hit',
          coffeeName: result.coffeeName,
          roasterName: result.roasterName,
          coffeeId: result.coffeeId,
        })
      } else if (result.source === 'open_food_facts') {
        setBarcodeState({
          step: 'off_hit',
          barcode,
          productName: result.productName,
          brand: result.brand,
        })
      } else {
        setBarcodeState({ step: 'not_found', barcode })
      }
    })
  }

  function handleConfirmAfterScan(barcode: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await confirmBarcodeCoffee(barcode, rawText)
        router.push(`/coffee/${result.coffeeId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`rounded px-3 py-1 font-medium ${mode === 'paste' ? 'bg-accent text-bg hover:bg-accent-hover' : 'bg-surface text-text-muted'}`}
        >
          Paste / URL
        </button>
        <button
          type="button"
          onClick={() => setMode('scan')}
          className={`rounded px-3 py-1 font-medium ${mode === 'scan' ? 'bg-accent text-bg hover:bg-accent-hover' : 'bg-surface text-text-muted'}`}
        >
          Scan barcode
        </button>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      {mode === 'paste' && (
        <div className="flex flex-col gap-3">
          <input
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
            placeholder="Listing URL (optional)"
            className="rounded border border-surface-raised bg-surface p-2 placeholder:text-text-muted"
          />
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the listing text here"
            rows={8}
            className="rounded border border-surface-raised bg-surface p-2 placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={isPending || rawText.trim().length === 0}
            className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? 'Adding…' : 'Add coffee'}
          </button>
        </div>
      )}

      {mode === 'scan' && (
        <div className="flex flex-col gap-4">
          {barcodeState.step === 'idle' && (
            <BarcodeScanner
              onDetected={handleBarcodeDetected}
              onError={setError}
            />
          )}

          {barcodeState.step === 'catalog_hit' && (
            <div className="rounded border border-surface-raised bg-surface p-4">
              <p className="font-medium">
                You&apos;ve had this — {barcodeState.roasterName}
              </p>
              <p>{barcodeState.coffeeName}</p>
              <button
                type="button"
                onClick={() => router.push(`/coffee/${barcodeState.coffeeId}`)}
                className="mt-3 rounded bg-accent px-3 py-2 font-medium text-bg hover:bg-accent-hover"
              >
                View / rate again
              </button>
            </div>
          )}

          {(barcodeState.step === 'off_hit' ||
            barcodeState.step === 'not_found') && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                {barcodeState.step === 'off_hit'
                  ? `Found "${barcodeState.productName}"${barcodeState.brand ? ` (${barcodeState.brand})` : ''} in the open product database — specialty roasters rarely have full tasting notes there. Paste the bag's full listing text below to get proper flavor/process details.`
                  : "New barcode — not in our catalog or the open product database. Paste the listing text or snap the bag's info below."}
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the listing text (or type what's on the bag)"
                rows={8}
                className="rounded border border-surface-raised bg-surface p-2 placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={() => handleConfirmAfterScan(barcodeState.barcode)}
                disabled={isPending || rawText.trim().length === 0}
                className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? 'Adding…' : 'Add coffee'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace `src/components/coffee/BarcodeScanner.tsx`**

Keep all logic; only the `return` JSX classes change. Full file:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'

export function BarcodeScanner({
  onDetected,
  onError,
}: {
  onDetected: (barcode: string) => void
  onError?: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    return () => {
      BrowserCodeReader.releaseAllStreams()
    }
  }, [])

  async function start() {
    setScanning(true)
    try {
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeOnceFromVideoDevice(
        undefined,
        videoRef.current ?? undefined,
      )
      onDetected(result.getText())
    } catch (err) {
      onError?.(
        err instanceof Error
          ? err.message
          : 'Could not read a barcode from the camera.',
      )
    } finally {
      setScanning(false)
      BrowserCodeReader.releaseAllStreams()
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video
        ref={videoRef}
        className="w-full max-w-sm rounded border border-surface-raised"
        muted
        playsInline
      />
      <button
        type="button"
        onClick={start}
        disabled={scanning}
        className="rounded bg-accent px-4 py-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : 'Scan barcode'}
      </button>
    </div>
  )
}
```

Changes: video frame gains `border border-surface-raised`; scan button becomes an accent button.

- [ ] **Step 4: Verify types + tests**

Run: `npx tsc --noEmit` → clean. `npm run test:run` → existing suite green.

- [ ] **Step 5: Browser-verify the Add-coffee screen**

Load `/coffee/add`. Confirm: heading in Fraunces; the Paste/URL vs Scan mode buttons show the active one as an accent button and the inactive one as a muted `surface` button; the URL input and textarea are `surface` fields with muted placeholder text, legible against the page; the "Add coffee" button is accent with dark text and disables/greys when the textarea is empty. Toggle to Scan mode and confirm the "Scan barcode" button is accent (camera won't necessarily start in the automation browser — just verify styling).

- [ ] **Step 6: Commit**

```bash
git add src/app/coffee/add/page.tsx src/components/coffee/AddCoffeeForm.tsx src/components/coffee/BarcodeScanner.tsx
git commit -m "feat(ui): re-skin Add-coffee flow (mode tabs, inputs, buttons)"
```

---

### Task 5: Coffee detail — page + RateReviewForm (consumes Chip)

**Files:**
- Modify: `src/app/coffee/[id]/page.tsx`
- Modify: `src/components/coffee/RateReviewForm.tsx`

**Interfaces:**
- Consumes: color/`font-display` utilities from Task 1; `Chip` from Task 2 (`import { Chip } from '@/components/ui/Chip'`).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace `src/app/coffee/[id]/page.tsx`**

Logic (data fetching, `notFound`, `Promise.all`) unchanged; only imports (add `Chip`) and JSX classes change. Full file:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoffeeDetail } from '@/lib/actions/coffee'
import { listShotsForCoffee, listCoffeeDialIns } from '@/lib/actions/shots'
import { RateReviewForm } from '@/components/coffee/RateReviewForm'
import { DialInCard } from '@/components/shots/DialInCard'
import { Chip } from '@/components/ui/Chip'

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coffee = await getCoffeeDetail(id)
  if (!coffee) notFound()

  const [shots, dialIns] = await Promise.all([
    listShotsForCoffee(id),
    listCoffeeDialIns(id),
  ])

  return (
    <main className="max-w-lg mx-auto p-4">
      <p className="text-sm text-text-muted">{coffee.roasterName}</p>
      <h1 className="text-2xl font-display font-semibold">{coffee.name}</h1>

      <dl className="mt-3 text-sm grid grid-cols-2 gap-1">
        {coffee.originCountry && (
          <>
            <dt className="text-text-muted">Origin</dt>
            <dd>
              {[coffee.originCountry, coffee.originRegion]
                .filter(Boolean)
                .join(', ')}
            </dd>
          </>
        )}
        {coffee.variety && (
          <>
            <dt className="text-text-muted">Variety</dt>
            <dd>{coffee.variety}</dd>
          </>
        )}
        {coffee.process && (
          <>
            <dt className="text-text-muted">Process</dt>
            <dd>{coffee.processDetail ?? coffee.process}</dd>
          </>
        )}
      </dl>

      {coffee.tastingNotes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {coffee.tastingNotes.map((note) => (
            <Chip key={note}>{note}</Chip>
          ))}
        </div>
      )}

      <RateReviewForm
        coffeeId={coffee.id}
        initialRating={coffee.rating}
        initialReview={coffee.review}
      />

      <section className="mt-6 border-t border-surface-raised pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-muted">Dial-in</h2>
          <Link
            href={`/coffee/${coffee.id}/log`}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Log shot
          </Link>
        </div>

        {dialIns.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {dialIns.map((d, i) => (
              <div key={i}>
                <p className="text-xs text-text-muted mb-1">
                  {d.grinderNickname} · {d.machineNickname}
                </p>
                <DialInCard state={d.state} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-text-muted mb-2">Shot history</h2>
        {shots.length === 0 ? (
          <p className="text-sm text-text-muted">No shots logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shots.map((s) => (
              <li key={s.id} className="rounded border border-surface-raised bg-surface p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{s.grindSetting}</span>
                  <span className="text-text-muted">
                    {s.doseGrams}g → {s.yieldGrams}g · {s.timeSeconds}s
                  </span>
                </div>
                <div className="text-xs text-text-muted">
                  {s.grinderNickname} · {s.machineNickname}
                  {s.outcomeTags.length > 0 && ` · ${s.outcomeTags.join(', ')}`}
                </div>
                {s.note && <p className="text-xs mt-1">{s.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
```

Changes: coffee name → `text-2xl font-display`; all `text-gray-*` → `text-text-muted`; tasting notes now render as `<Chip>` (the signature element); `border-t` → `border-t border-surface-raised`; Log shot → accent button; shot-history rows → content-card treatment. (Empty-state `text-gray-400` bumped to `text-text-muted` for legibility.)

- [ ] **Step 2: Replace `src/components/coffee/RateReviewForm.tsx`**

Logic unchanged; only JSX classes. Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { rateCoffee } from '@/lib/actions/coffee'
import { RatingStars } from './RatingStars'

export function RateReviewForm({
  coffeeId,
  initialRating,
  initialReview,
}: {
  coffeeId: string
  initialRating: number | null
  initialReview: string | null
}) {
  const [rating, setRating] = useState(initialRating)
  const [review, setReview] = useState(initialReview ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save(nextRating: number) {
    setRating(nextRating)
    setSaved(false)
    startTransition(async () => {
      await rateCoffee({ coffeeId, rating: nextRating, review })
      setSaved(true)
    })
  }

  function saveReview() {
    if (!rating) return
    startTransition(async () => {
      await rateCoffee({ coffeeId, rating, review })
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-surface-raised pt-3 mt-3">
      <RatingStars value={rating} onChange={save} />
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        onBlur={saveReview}
        placeholder="Notes on this coffee..."
        rows={3}
        className="rounded border border-surface-raised bg-surface p-2 text-sm placeholder:text-text-muted"
      />
      {isPending && <p className="text-xs text-text-muted">Saving…</p>}
      {saved && !isPending && <p className="text-xs text-success">Saved</p>}
    </div>
  )
}
```

Changes: `border-t` → `border-t border-surface-raised`; textarea → `surface` field + muted placeholder; Saving `text-gray-400` → `text-text-muted`; Saved `text-green-600` → `text-success`.

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit` → clean. `npm run test:run` → existing suite green (`src/app/coffee/[id]/page.test.tsx` uses `tastingNotes: []`, so the Chip path isn't asserted; it stays green).

- [ ] **Step 4: Browser-verify the Coffee detail screen**

Load a coffee detail route (from `/library`, click a card, or use a known `/coffee/<id>`). Confirm: coffee name in large Fraunces; roaster + origin/variety/process labels are muted but legible; tasting-note chips render as terracotta-outlined `surface-raised` stamps; the rating stars, review textarea (muted placeholder), "Saved"/"Saving…" text, the Log shot accent button, dial-in section divider, and shot-history rows are all legible with correct accent usage.

- [ ] **Step 5: Commit**

```bash
git add "src/app/coffee/[id]/page.tsx" src/components/coffee/RateReviewForm.tsx
git commit -m "feat(ui): re-skin Coffee detail (chips, rate/review, shot history)"
```

---

### Task 6: Equipment — page + EquipmentForm

**Files:**
- Modify: `src/app/equipment/page.tsx`
- Modify: `src/components/equipment/EquipmentForm.tsx`

**Interfaces:**
- Consumes: color/`font-display` utilities from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace `src/app/equipment/page.tsx`**

```tsx
import { listEquipment } from '@/lib/actions/equipment'
import { EquipmentForm } from '@/components/equipment/EquipmentForm'

export default async function EquipmentPage() {
  const items = await listEquipment()
  const grinders = items.filter((i) => i.kind === 'grinder')
  const machines = items.filter((i) => i.kind === 'machine')

  return (
    <main className="max-w-lg mx-auto p-4 flex flex-col gap-6">
      <h1 className="text-xl font-display font-semibold">Equipment</h1>

      <section>
        <h2 className="text-sm font-medium text-text-muted mb-2">Grinders</h2>
        {grinders.length === 0 ? (
          <p className="text-sm text-text-muted">No grinders yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {grinders.map((g) => (
              <li key={g.id} className="text-sm rounded border border-surface-raised bg-surface p-2">
                {g.nickname}
                {g.microStepsPerMacroNotch !== null && (
                  <span className="text-text-muted">
                    {' '}
                    · micro ÷{g.microStepsPerMacroNotch}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-muted mb-2">Machines</h2>
        {machines.length === 0 ? (
          <p className="text-sm text-text-muted">No machines yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {machines.map((m) => (
              <li key={m.id} className="text-sm rounded border border-surface-raised bg-surface p-2">
                {m.nickname}
              </li>
            ))}
          </ul>
        )}
      </section>

      <EquipmentForm />
    </main>
  )
}
```

Changes: `h1` gains `font-display`; section `h2` and empty-state `text-gray-*` → `text-text-muted`; list rows → content-card treatment; micro note `text-gray-400` → `text-text-muted`.

- [ ] **Step 2: Replace `src/components/equipment/EquipmentForm.tsx`**

Logic (state, `submit`, imports) unchanged; only JSX classes. Note per Global Constraints: this form-wrapping card is **outline-only** (no `bg` fill) so its `surface` inputs stay visible. Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEquipment, type EquipmentKind } from '@/lib/actions/equipment'
import { DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH } from '@/lib/grind/constants'

export function EquipmentForm() {
  const router = useRouter()
  const [kind, setKind] = useState<EquipmentKind>('grinder')
  const [nickname, setNickname] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [hasMicroDial, setHasMicroDial] = useState(false)
  const [microSteps, setMicroSteps] = useState(DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH)
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      await createEquipment({
        kind,
        nickname,
        brand: brand || undefined,
        model: model || undefined,
        microStepsPerMacroNotch:
          kind === 'grinder' && hasMicroDial ? microSteps : null,
      })
      setNickname('')
      setBrand('')
      setModel('')
      setHasMicroDial(false)
      setMicroSteps(DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-surface-raised p-4">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EquipmentKind)}
          className="rounded border border-surface-raised bg-surface p-2"
        >
          <option value="grinder">Grinder</option>
          <option value="machine">Machine</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nickname
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Brand (optional)
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Model (optional)
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      {kind === 'grinder' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasMicroDial}
            onChange={(e) => setHasMicroDial(e.target.checked)}
            className="accent-accent"
          />
          Has a secondary/micro adjustment?
        </label>
      )}

      {kind === 'grinder' && hasMicroDial && (
        <label className="flex flex-col gap-1 text-sm">
          Micro steps per macro notch
          <input
            type="number"
            value={microSteps}
            onChange={(e) => setMicroSteps(Number(e.target.value))}
            className="rounded border border-surface-raised bg-surface p-2"
          />
        </label>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || nickname.trim().length === 0}
        className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add equipment'}
      </button>
    </div>
  )
}
```

Changes: wrapper card `border rounded p-4` → outline-only `rounded border border-surface-raised p-4`; all selects/inputs → `surface` fields; checkbox gains `accent-accent`; Add-equipment button → accent.

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit` → clean. `npm run test:run` → existing suite green (`EquipmentForm.test.tsx` asserts behavior, not classes — stays green).

- [ ] **Step 4: Browser-verify the Equipment screen**

Load `/equipment`. Confirm: heading in Fraunces; Grinders/Machines subheads muted-legible; any equipment rows render as `surface` cards; the Add-equipment form is an outlined panel whose select/inputs are visible `surface` fields on the page; toggling to Grinder shows the micro-dial checkbox (terracotta when checked); the Add-equipment button is accent and disabled until a nickname is typed.

- [ ] **Step 5: Commit**

```bash
git add src/app/equipment/page.tsx src/components/equipment/EquipmentForm.tsx
git commit -m "feat(ui): re-skin Equipment screen (list rows, add form)"
```

---

### Task 7: Shot logging — page + ShotForm + DialInCard

**Files:**
- Modify: `src/app/coffee/[id]/log/page.tsx`
- Modify: `src/components/shots/ShotForm.tsx`
- Modify: `src/components/shots/DialInCard.tsx`

**Interfaces:**
- Consumes: color/`font-display` utilities from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace `src/app/coffee/[id]/log/page.tsx`**

```tsx
import Link from 'next/link'
import { listEquipment } from '@/lib/actions/equipment'
import { getLastShot } from '@/lib/actions/shots'
import { ShotForm } from '@/components/shots/ShotForm'

export default async function LogShotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [grinders, machines, prefill] = await Promise.all([
    listEquipment('grinder'),
    listEquipment('machine'),
    getLastShot(id),
  ])

  if (grinders.length === 0 || machines.length === 0) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <h1 className="text-xl font-display font-semibold mb-2">Log shot</h1>
        <p className="text-sm text-text-muted">
          Add at least one grinder and one machine first.{' '}
          <Link href="/equipment" className="text-accent underline">
            Go to Equipment
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-display font-semibold mb-3">Log shot</h1>
      <ShotForm coffeeId={id} grinders={grinders} machines={machines} prefill={prefill} />
    </main>
  )
}
```

Changes: both `h1`s gain `font-display`; guard text `text-gray-600` → `text-text-muted`; the "Go to Equipment" link → `text-accent underline`.

- [ ] **Step 2: Replace `src/components/shots/ShotForm.tsx`**

Logic (constants, `toNumber`, all state, `grindValid`/`canSubmit`, the `useEffect`, `toggleTag`, `submit`) unchanged; only JSX classes change. Full file:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logShot, getDialInState } from '@/lib/actions/shots'
import type { ShotPrefill } from '@/lib/actions/shots'
import type { EquipmentItem } from '@/lib/actions/equipment'
import type { DialInState } from '@/lib/grind/suggestion'
import { DialInCard } from './DialInCard'

const OUTCOME_TAGS = [
  'sour',
  'bitter',
  'weak',
  'harsh',
  'balanced',
  'excellent',
] as const

function toNumber(value: string): number {
  return Number.parseFloat(value)
}

export function ShotForm({
  coffeeId,
  grinders,
  machines,
  prefill,
}: {
  coffeeId: string
  grinders: EquipmentItem[]
  machines: EquipmentItem[]
  prefill: ShotPrefill
}) {
  const router = useRouter()
  const [grinderId, setGrinderId] = useState(prefill?.grinderId ?? grinders[0]?.id ?? '')
  const [machineId, setMachineId] = useState(prefill?.machineId ?? machines[0]?.id ?? '')
  const [dose, setDose] = useState(prefill ? String(prefill.doseGrams) : '')
  const [yieldG, setYieldG] = useState(prefill ? String(prefill.yieldGrams) : '')
  const [time, setTime] = useState('')
  const [macro, setMacro] = useState('')
  const [micro, setMicro] = useState('')
  const [grindText, setGrindText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [dialIn, setDialIn] = useState<DialInState | null>(null)
  const [isPending, startTransition] = useTransition()

  const grinder = grinders.find((g) => g.id === grinderId) ?? null
  const hasMicroDial = grinder?.microStepsPerMacroNotch != null

  // Guard the write path: dose/yield/time must parse to finite numbers, and the
  // grind entry must be present (a finite macro for micro-dial grinders, or any
  // non-empty label for single-dial ones — free text is intentionally allowed
  // there and stored as interpolation-ineligible). Without this, a blank submit
  // writes NaN into the numeric columns and stalls the suggestion engine.
  const grindValid = hasMicroDial
    ? Number.isFinite(toNumber(macro))
    : grindText.trim().length > 0
  const canSubmit =
    !!grinderId &&
    !!machineId &&
    Number.isFinite(toNumber(dose)) &&
    Number.isFinite(toNumber(yieldG)) &&
    Number.isFinite(toNumber(time)) &&
    grindValid

  // Refresh the dial-in card whenever the combo (coffee is fixed) changes.
  useEffect(() => {
    if (!grinderId || !machineId) return
    let cancelled = false
    getDialInState({ coffeeId, grinderId, machineId }).then((state) => {
      if (!cancelled) setDialIn(state)
    })
    return () => {
      cancelled = true
    }
  }, [coffeeId, grinderId, machineId])

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function submit() {
    startTransition(async () => {
      await logShot({
        coffeeId,
        grinderId,
        machineId,
        doseGrams: toNumber(dose),
        yieldGrams: toNumber(yieldG),
        timeSeconds: toNumber(time),
        ...(hasMicroDial
          ? {
              macroInput: toNumber(macro),
              microInput: micro === '' ? 0 : toNumber(micro),
            }
          : { textInput: grindText }),
        outcomeTags: tags,
        note: note || undefined,
      })
      router.push(`/coffee/${coffeeId}`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {dialIn && <DialInCard state={dialIn} />}

      <label className="flex flex-col gap-1 text-sm">
        Grinder
        <select
          value={grinderId}
          onChange={(e) => setGrinderId(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        >
          {grinders.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Machine
        <select
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          className="rounded border border-surface-raised bg-surface p-2"
        >
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Dose (g)
        <input value={dose} onChange={(e) => setDose(e.target.value)} inputMode="decimal" className="rounded border border-surface-raised bg-surface p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Yield (g)
        <input value={yieldG} onChange={(e) => setYieldG(e.target.value)} inputMode="decimal" className="rounded border border-surface-raised bg-surface p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Time (s)
        <input value={time} onChange={(e) => setTime(e.target.value)} inputMode="decimal" className="rounded border border-surface-raised bg-surface p-2" />
      </label>

      {hasMicroDial ? (
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Grind (macro)
            <input value={macro} onChange={(e) => setMacro(e.target.value)} inputMode="decimal" className="rounded border border-surface-raised bg-surface p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Micro adjust
            <input value={micro} onChange={(e) => setMicro(e.target.value)} inputMode="decimal" className="rounded border border-surface-raised bg-surface p-2" />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Grind setting
          <input value={grindText} onChange={(e) => setGrindText(e.target.value)} className="rounded border border-surface-raised bg-surface p-2" />
        </label>
      )}

      <fieldset className="flex flex-wrap gap-2">
        {OUTCOME_TAGS.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`text-xs rounded-full px-3 py-1 border border-surface-raised ${
              tags.includes(tag) ? 'bg-accent text-bg' : 'bg-surface text-text-muted'
            }`}
          >
            {tag}
          </button>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded border border-surface-raised bg-surface p-2" />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !canSubmit}
        className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save shot'}
      </button>
    </div>
  )
}
```

Changes: all selects/inputs/textarea → `surface` fields; outcome-tag toggles active `bg-black text-white` → `bg-accent text-bg`, inactive `bg-white` → `bg-surface text-text-muted` (border → `border-surface-raised`); Save button → accent.

- [ ] **Step 3: Replace `src/components/shots/DialInCard.tsx`**

Logic (all `state.kind` / `status` branches) unchanged; only JSX classes. Full file:

```tsx
import type { DialInState } from '@/lib/grind/suggestion'

export function DialInCard({ state }: { state: DialInState }) {
  if (state.kind === 'new_bag') {
    const b = state.baseline
    if (b.status === 'insufficient_history') {
      return (
        <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
          New coffee on this grinder — log shots to build a suggestion (or reach{' '}
          {b.shotsNeeded} total on this grinder + machine for a rough starting point).
        </div>
      )
    }
    return (
      <div className="rounded border-l-4 border-accent bg-surface-raised p-3 text-sm">
        <p className="font-medium">Rough starting point: {b.display}</p>
        <p className="text-text-muted">
          Estimated from your balanced/excellent shots on this grinder + machine
          (any coffee). Not yet calibrated to this coffee.
        </p>
      </div>
    )
  }

  const s = state.suggestion
  if (s.status === 'need_more_shots') {
    return (
      <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
        Log {s.shotsNeeded - s.shotsLogged} more shot
        {s.shotsNeeded - s.shotsLogged === 1 ? '' : 's'} on this combo to unlock a
        suggestion ({s.shotsLogged}/{s.shotsNeeded}).
      </div>
    )
  }
  if (s.status === 'need_positive_reference') {
    return (
      <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
        Log a shot you rate balanced or excellent to activate suggestions.
      </div>
    )
  }
  if (s.status === 'need_variation') {
    return (
      <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
        Try a shot at a different setting to unlock suggestions.
      </div>
    )
  }

  return (
    <div className="rounded border-l-4 border-success bg-surface-raised p-3 text-sm">
      <p className="font-medium">
        Suggested grind: {s.display} → ~{Math.round(s.targetTime)}s
      </p>
      <ul className="mt-2 text-text-muted">
        {s.evidence.map((e, i) => (
          <li key={i}>
            setting {e.grindPosition} → {e.timeSeconds}s
            {e.outcomeTags.length > 0 && ` (${e.outcomeTags.join(', ')})`}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Changes: the plain info/"need more" cards → `rounded border border-surface-raised … text-text-muted`; the `bg-amber-50` "rough starting point" card → banner treatment (`border-l-4 border-accent bg-surface-raised`); the `bg-green-50` active-suggestion card → success banner treatment (`border-l-4 border-success bg-surface-raised`); inner `text-gray-*` → `text-text-muted`.

- [ ] **Step 4: Verify types + tests**

Run: `npx tsc --noEmit` → clean. `npm run test:run` → existing suite green (`ShotForm.test.tsx` asserts behavior/values, not classes).

- [ ] **Step 5: Browser-verify the Shot-logging screen**

Load a `/coffee/<id>/log` route for a coffee whose equipment exists (add a grinder + machine first via `/equipment` if needed). Confirm: heading in Fraunces; all grinder/machine selects and the dose/yield/time/grind inputs are visible `surface` fields; outcome-tag toggles show selected = accent, unselected = muted `surface`; the Save shot button is accent and disabled until the form is valid; any dial-in card at the top uses the banner treatments (accent stripe for rough-start, success stripe for an active suggestion) with legible text. Also load a `/coffee/<id>/log` for a coffee with no equipment and confirm the "Add … first / Go to Equipment" guard message is legible with an accent link.

- [ ] **Step 6: Commit**

```bash
git add "src/app/coffee/[id]/log/page.tsx" src/components/shots/ShotForm.tsx src/components/shots/DialInCard.tsx
git commit -m "feat(ui): re-skin Shot logging + dial-in cards"
```

---

### Task 8: Profile — ProfileView + DirectiveEditor + page (consumes Chip)

**Files:**
- Modify: `src/components/profile/ProfileView.tsx`
- Modify: `src/components/profile/DirectiveEditor.tsx`
- Modify: `src/app/profile/page.tsx`

**Interfaces:**
- Consumes: color/`font-display` utilities from Task 1; `Chip` from Task 2 (`import { Chip } from '@/components/ui/Chip'`).
- Produces: nothing (final screen).

- [ ] **Step 1: Replace `src/components/profile/ProfileView.tsx`**

Logic (state, `rebuild`, the `cold_start` / `never_built` / `stale` / fresh branches) unchanged; only imports (add `Chip`), the cluster label element, the process label format, and JSX classes change. Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rebuildProfile, type ProfileView as ProfileViewData } from '@/lib/actions/taste'
import { MIN_RATED_COFFEES_FOR_PROFILE } from '@/lib/taste/constants'
import { Chip } from '@/components/ui/Chip'

export function ProfileView({ view }: { view: ProfileViewData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function rebuild() {
    setError(null)
    startTransition(async () => {
      try {
        await rebuildProfile()
        router.refresh()
      } catch {
        setError('Could not rebuild your profile right now — try again.')
      }
    })
  }

  if (view.state === 'cold_start') {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">
          Not personalized yet — rate a few more coffees ({view.ratedCount} of{' '}
          {MIN_RATED_COFFEES_FOR_PROFILE}). Your stated goals below still guide discovery
          in the meantime.
        </p>
      </section>
    )
  }

  if (view.state === 'never_built') {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-sm">You have enough ratings to build your taste profile.</p>
        <button
          type="button"
          onClick={rebuild}
          disabled={isPending}
          className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50 self-start"
        >
          {isPending ? 'Building…' : 'Build your profile'}
        </button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </section>
    )
  }

  const profile = view.profile!
  return (
    <section className="flex flex-col gap-4">
      {view.state === 'stale' && (
        <div role="status" className="flex items-center justify-between gap-3 rounded border-l-4 border-accent bg-surface-raised p-2 text-sm">
          <span>
            {view.newRatingsSince} new rating{view.newRatingsSince === 1 ? '' : 's'} since last build.
          </span>
          <button
            type="button"
            onClick={rebuild}
            disabled={isPending}
            className="rounded bg-accent px-3 py-1 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? 'Rebuilding…' : 'Rebuild profile'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {profile.summary && <p className="text-sm">{profile.summary}</p>}

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Flavor clusters</h3>
        {profile.clusters.length === 0 ? (
          <p className="text-sm text-text-muted">No strong flavor preferences yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.clusters.map((c) => (
              <li key={c.cluster} className="flex flex-col gap-1">
                <span className="self-start">
                  <Chip>{c.cluster.replace(/_/g, '-')}</Chip>
                </span>
                <div aria-hidden className="h-2 rounded bg-surface-raised">
                  <div className="h-2 rounded bg-accent" style={{ width: `${Math.round(c.affinity * 100)}%` }} />
                </div>
                <small className="text-text-muted">{c.evidence}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Preferred processes</h3>
        {profile.processes.length === 0 ? (
          <p className="text-sm text-text-muted">No strong process preferences yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {profile.processes.map((p) => (
              <li key={p.process} className="text-sm">
                <span>{p.process.replace(/_/g, '-')}</span> <small className="text-text-muted">{p.evidence}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {view.builtAt && (
        <p className="text-xs text-text-muted">Last built {new Date(view.builtAt).toLocaleDateString()}</p>
      )}
    </section>
  )
}
```

Changes: import + use `Chip` for the cluster label (wrapped in a `self-start` span so the chip doesn't stretch full-width); cluster label keeps the same `.replace(/_/g, '-')` text (so the existing `getByText('fruit-candied')` test still passes); process label gains the same `.replace(/_/g, '-')` format (the Plan 3 minor — a single-word process like `anaerobic` is unchanged, so `getByText('anaerobic')` still passes); affinity-bar track `bg-gray-200` → `bg-surface-raised` and fill `bg-black` → `bg-accent`; stale banner `border border-amber-300 bg-amber-50` → `border-l-4 border-accent bg-surface-raised` (banner body text uses default `text` color, not muted, per the contrast constraint); Build/Rebuild buttons → accent; error `text-red-600` → `text-danger`; all remaining `text-gray-*` → `text-text-muted`.

- [ ] **Step 2: Replace `src/components/profile/DirectiveEditor.tsx`**

Logic (GOAL_OPTIONS, state, `toggleGoal`, `save`) unchanged; only JSX classes. Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDirective, type DirectiveView } from '@/lib/actions/taste'

const GOAL_OPTIONS = [
  { value: 'wild_process', label: 'Discover wild process-driven flavors' },
  { value: 'daily_drinkers', label: 'Find reliable daily drinkers' },
  { value: 'explore_origins', label: 'Explore specific origins' },
] as const

export function DirectiveEditor({ directive }: { directive: DirectiveView }) {
  const router = useRouter()
  const [goals, setGoals] = useState<string[]>(directive.goals)
  const [freeText, setFreeText] = useState(directive.freeText ?? '')
  const [excludeAddedFlavor, setExclude] = useState(directive.excludeAddedFlavor)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggleGoal(value: string) {
    setSaved(false)
    setGoals((prev) => (prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]))
  }

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await saveDirective({ goals, freeText: freeText || null, excludeAddedFlavor })
        setSaved(true)
        router.refresh()
      } catch {
        setError('Could not save your goals right now — try again.')
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 border-t border-surface-raised pt-4">
      <h2 className="font-medium">Your goals</h2>

      <fieldset className="flex flex-col gap-2">
        {GOAL_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={goals.includes(o.value)}
              onChange={() => toggleGoal(o.value)}
              className="accent-accent"
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Anything else?
        <textarea
          value={freeText}
          onChange={(e) => {
            setSaved(false)
            setFreeText(e.target.value)
          }}
          rows={2}
          className="rounded border border-surface-raised bg-surface p-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={excludeAddedFlavor}
          onChange={(e) => {
            setSaved(false)
            setExclude(e.target.checked)
          }}
          className="accent-accent"
        />
        Exclude added-flavor coffees
      </label>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50 self-start"
      >
        {isPending ? 'Saving…' : 'Save goals'}
      </button>
      {saved && <p role="status" className="text-sm text-success">Saved.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  )
}
```

Changes: `border-t` → `border-t border-surface-raised`; checkboxes gain `accent-accent`; textarea → `surface` field; Save goals button → accent; Saved `text-green-700` → `text-success`; error `text-red-600` → `text-danger`.

- [ ] **Step 3: Replace `src/app/profile/page.tsx`**

```tsx
import { getProfileView, getDirective } from '@/lib/actions/taste'
import { ProfileView } from '@/components/profile/ProfileView'
import { DirectiveEditor } from '@/components/profile/DirectiveEditor'

export default async function ProfilePage() {
  const [view, directive] = await Promise.all([getProfileView(), getDirective()])
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pb-20">
      <h1 className="text-xl font-display font-semibold">Your taste profile</h1>
      <ProfileView view={view} />
      <DirectiveEditor directive={directive} />
    </main>
  )
}
```

Change only: `h1` gains `font-display`.

- [ ] **Step 4: Verify types + tests**

Run: `npx tsc --noEmit` → clean. `npm run test:run` → existing suite green. Pay attention to `ProfileView.test.tsx` and `DirectiveEditor.test.tsx` — both must still pass. The cluster `getByText('fruit-candied')` and process `getByText('anaerobic')` assertions survive because the rendered text is unchanged for those fixtures (Chip wraps the same text; `anaerobic` has no underscore to transform).

- [ ] **Step 5: Browser-verify the Profile screen**

Load `/profile`. Confirm: heading in Fraunces; whichever state renders (cold-start message, never-built with a Build button, stale banner, or a fresh profile) is legible with correct accent usage. If a fresh profile shows: flavor-cluster labels render as terracotta-outlined chips above `surface-raised` affinity-bar tracks with `accent` fills; evidence lines are muted-legible; process labels are hyphen-formatted; the "Your goals" section has a legible divider, terracotta checkboxes, a `surface` free-text field, an accent Save goals button, and legible Saved/error text. If it shows cold-start/never-built instead, confirm those are legible and (for never-built) the Build button is accent.

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/ProfileView.tsx src/components/profile/DirectiveEditor.tsx src/app/profile/page.tsx
git commit -m "feat(ui): re-skin Profile (chips, affinity bars, goals form)"
```

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Palette tokens → Task 1 (`globals.css` `@theme`). ✅
- Committed single theme / remove media query + light `:root` → Task 1. ✅
- Typography (Fraunces + Karla via `next/font/google`, remove dead Geist + Arial) → Task 1. ✅
- Signature stamped chips → Task 2 creates `Chip`; Task 5 (tasting notes) + Task 8 (cluster labels) consume it. ✅
- NavBar treatment → Task 2. ✅
- Primary buttons (accent bg, `bg`-colored text) → Tasks 3, 4, 5, 6, 7, 8 (every button). ✅
- Tabs (accent underline, no gray block) → Task 3 (Library tabs); Add-coffee mode toggles → Task 4. ✅
- Banners (surface-raised + accent stripe, replace `bg-amber-50`) → Task 8 (stale banner) + Task 7 (dial-in rough-start card). ✅
- Progress/affinity bars (surface-raised track, accent fill) → Task 8. ✅
- Error text = `danger`, save confirmations = `success` → Tasks 4, 5, 8. ✅
- Full Scope file list (15 spec-listed files) → all covered; plus RatingStars, RateReviewForm, BarcodeScanner (implicit "form component(s)" / shared components the spec's file list references) folded into their screens' tasks. ✅
- Out-of-scope respected: no layout/IA/route/data/prop changes; the only two behavioral touches (NavBar `usePathname`, process `.replace`) are styling-state/format-only and called out. ✅
- Contrast floor → Global Constraints computed the flagged `accent-hover` fix (`#BE7345`, 4.79:1) and the muted-on-surface-raised caveat. ✅
- Verification = existing suite green + browser walkthrough → every task, Steps 3–5. ✅

**2. Placeholder scan** — no "TBD"/"handle appropriately"/"similar to Task N"/"write tests for the above". Every code step shows the complete file. ✅

**3. Type/name consistency** — `Chip` signature (`{ children: ReactNode }`, import path `@/components/ui/Chip`) is identical in Task 2 (produce), Task 5, and Task 8 (consume). Color/font utility names (`bg-accent`, `text-bg`, `text-text-muted`, `border-surface-raised`, `font-display`, `hover:bg-accent-hover`, `accent-accent`) are used consistently and all derive from the tokens defined in Task 1. No component prop or exported-signature changed, so no cross-file type drift. ✅
