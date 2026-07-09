# Visual Identity — Design Spec

**Goal:** Give the app one deliberate, coherent visual identity — a "third-wave cafe at night" mood — replacing the unstyled Tailwind defaults every screen has used since Plan 1, and fixing the contrast/font bugs that fall out of that.

## Background / Problem

No visual design has ever been applied to this app. Every screen (Library, Equipment, Shot logging, Coffee detail, Profile) uses whatever default Tailwind utility classes were reached for at write time, with no shared palette or type system. This produces two concrete bugs, plus a generic look:

1. **Font override:** `src/app/globals.css` defines `--font-sans: var(--font-geist-sans)` in its `@theme inline` block, but `--font-geist-sans` is never actually set anywhere (no `next/font` import exists in the codebase). The `body` rule then hardcodes `font-family: Arial, Helvetica, sans-serif`, which wins regardless. Every screen renders in the browser's default system sans-serif.
2. **Dark-mode contrast breaks:** `globals.css` flips `--background`/`--foreground` via a `prefers-color-scheme: dark` media query, but that only affects the bare `body` background/text. Every component uses fixed, light-mode-oriented Tailwind colors with no `dark:` variant — e.g. `NavBar.tsx`'s `bg-white` nav bar, `ProfileView.tsx`'s `bg-amber-50` stale banner, `library/page.tsx`'s `bg-gray-200` inactive tab. In dark mode, text inside these elements inherits the near-white body foreground color, landing on a light background → invisible or near-invisible text. This is visible on every page (the nav bar) and is the literal "white text on white background" bug.

## Decision: one committed theme, not light+dark

The app supports exactly one visual theme going forward — dark, warm, "third-wave cafe at night." The `prefers-color-scheme` media query and the light-mode `:root` values are removed entirely. This eliminates the whole class of "forgot the dark: variant" bugs at the root, since there is no second variant to forget. (This is a single-user personal app; OS theme-matching isn't worth the maintenance surface.)

## Palette

Six tokens, defined once in `globals.css` under `@theme` so Tailwind generates matching utilities (`bg-surface`, `text-accent`, etc.) automatically (Tailwind v4 CSS-first theme):

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#1E1812` | Page background |
| `--color-surface` | `#2B2219` | Cards, panels, input backgrounds |
| `--color-surface-raised` | `#3D3226` | Borders, dividers, banners, progress-bar tracks |
| `--color-text` | `#EDE3D3` | Primary text (warm parchment, not stark white) |
| `--color-text-muted` | `#A99A87` | Secondary text: evidence strings, labels, timestamps |
| `--color-accent` | `#C97C4B` | The one accent: primary buttons, active tab/nav state, links, progress-bar fill |
| `--color-accent-hover` | `#B36A3D` | Hover/active state for accent-colored controls |
| `--color-danger` | `#D2684A` | Error text/alerts (muted brick red, not stock red) |
| `--color-success` | `#8FA06B` | Save confirmations (muted sage, not stock green) |

No pure black or pure white anywhere in the palette.

**Contrast is a hard requirement, not a suggestion — computed, not eyeballed.** Checked every pairing against WCAG AA (4.5:1 normal text, 3:1 large/bold text) by computing relative luminance directly:
- `text` / `text-muted` on `bg` or `surface`: 13.8:1 / 6.4:1 and 12.3:1 / 5.7:1 respectively — comfortable margin.
- `accent` used as text/underline directly on `bg`: 5.4:1 — passes.
- `accent` used as a **button background**: pairing it with `text` (cream) foreground only reaches ~2.6:1 (fails badly) — cream-on-terracotta is too close in lightness. Pairing it with `bg`-colored (near-black) foreground reaches ~5.4:1 (passes). **Decision: buttons use `bg`-colored text on `accent` background, not `text`-colored.** This reads correctly for the mood too — dark ink on a warm terracotta stamp, not the inverse.
- `danger` (`#D2684A`, adjusted from an earlier darker draft that only hit ~3.9:1) on `bg`: 4.9:1 — passes.
- `success` on `bg`: 6.2:1 — passes.
- `accent-hover` (`#B36A3D`) paired with `bg`-colored text lands closer to 4.2:1 — under the 4.5:1 floor for small/regular-weight button text, though it's a transient hover-only state. Implementation should re-check this specific pairing once built (nudge `accent-hover` lighter, or confirm the button's actual rendered text qualifies as "large text" under WCAG) rather than treat the value above as final.

## Typography

- **Display (`font-display`):** Fraunces — a warm, slightly irregular serif with real character, used for page headings and any large numbers/labels that should stand out (e.g. "Your taste profile", coffee names). Loaded via `next/font/google`.
- **Body (`font-sans`):** Karla — a humanist sans for body text, labels, buttons, evidence strings. Loaded via `next/font/google`.
- Both replace the current dead `--font-geist-sans` reference and the hardcoded `Arial, Helvetica` override, which are removed.

## Signature element: stamped tasting-note chips

Tasting-note tags (coffee detail page) and flavor-cluster labels (Profile) share one distinct treatment: a small chip with a thin `accent`-colored border and a `surface-raised` fill, evoking the small stickers/stamps a roaster puts on a coffee bag. This replaces plain gray pills and is the one place the design takes a visible risk — everything else stays quiet and disciplined around it.

## Component treatments (representative, not exhaustive — implementation covers every screen)

- **NavBar:** `surface` background instead of `bg-white`; active route uses `accent` text/underline; inactive routes use `text-muted`.
- **Primary buttons** ("+ Add coffee", "Build your profile", "Save goals"): solid `accent` background, `bg`-colored (near-black) text — see the contrast note above for why; `accent-hover` on hover/press.
- **Tabs** (Library owned/wishlist/finished): active = `accent` underline + `text`; inactive = `text-muted`, no `bg-gray-200` block.
- **Banners** (stale-profile notice): `surface-raised` background with a left `accent` border stripe, replacing `bg-amber-50`.
- **Progress/affinity bars:** `surface-raised` track, `accent` fill, replacing `bg-gray-200` / `bg-black`.
- **Tasting-note / cluster chips:** the signature treatment described above.
- **Error text:** `danger` token. **Save confirmations:** `success` token.

## Scope

Every existing screen gets re-skinned with these tokens — this is a re-skin, not a layout or information-architecture change:

- `src/app/globals.css` (tokens, font loading, remove light-mode/media-query)
- `src/app/layout.tsx` (wire `next/font/google` for Fraunces + Karla)
- `src/components/layout/NavBar.tsx`
- `src/app/library/page.tsx`, `src/components/coffee/CoffeeCard.tsx`
- `src/app/coffee/add/page.tsx` and its form component(s)
- `src/app/coffee/[id]/page.tsx` (coffee detail, tasting-note chips)
- `src/app/equipment/page.tsx`, `src/components/equipment/EquipmentForm.tsx`
- `src/app/coffee/[id]/log/page.tsx`, `src/components/shots/ShotForm.tsx`, `src/components/shots/DialInCard.tsx`
- `src/components/profile/ProfileView.tsx`, `src/components/profile/DirectiveEditor.tsx`, `src/app/profile/page.tsx`

## Out of scope

- No layout, navigation structure, or information-architecture changes — same pages, same content, same flows.
- No new pages, animations, or interactions beyond simple hover/focus states.
- No accessibility regression: every color pairing must be verified for adequate contrast (text on its background) before merging: minimum 4.5:1 for body text, 3:1 for large/bold text, following WCAG AA as a floor.
- Visible keyboard focus states are preserved/added where missing; not a new requirement, just not to be lost in the re-skin.

## Testing / verification

No new unit-testable logic is introduced (this is styling only), so no new Vitest coverage is expected. Verification is: existing test suite still passes unchanged (styling changes shouldn't touch component logic/props), and a browser walkthrough (Claude-in-Chrome) across every listed screen confirming legible text, correct accent usage, and no contrast regressions — the same kind of live verification Plan 3 used.
