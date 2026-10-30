# Design system: fmcg-voice

## World

The visual language borrows from the **STD/ISD/PCO telephone booth**, the yellow painted signboard every Indian shopkeeper knows. It suits a voice agent that phones kirana retailers: a phone line, made for shops, plain and loud where it matters.

- **Signal yellow** is the brand colour. It works like the signboard: one decisive field, never sprinkled.
- **Ink** is warm black, tinted from the yellow. It carries all text and all primary actions.
- **Live red** is only for live voice states (mic on, call in progress) and destructive actions.

## Palette

| Role | Token | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| Ground | `--background` | `#FAFAF8` | `#12100A` | Page ground on working screens |
| Ink | `--foreground` | `#16130B` | `#F4F1E8` | Text, icons |
| Surface | `--card` | `#FFFFFF` | `#1C1910` | Raised panels |
| Muted ink | `--muted-foreground` | `#5C5647` | `#A9A291` | Secondary text (≥4.5:1 on ground) |
| Line | `--border` | `#E6E3DA` | `#FFFFFF1A` | Dividers, input borders |
| Signal | `--signal` | `#FFC800` | `#FFC800` | Brand field, selection, highlights |
| On signal | `--signal-foreground` | `#16130B` | `#16130B` | Text and marks on signal yellow |
| Live | `--live` | `#D92D20` | `#F04438` | Live/recording state, destructive |

**Primary action:** an ink button with signal-yellow text in light mode (the signboard reversed), and a yellow button with ink text in dark mode.

**Colour strategy by mode:**
- *Persuade or edge screens* (404, landing, empty states): **Drenched**, so the surface is signal yellow.
- *Operate screens* (conversation, history): **Restrained**, so the ground is neutral, with yellow reserved for the primary action, the active voice state and selection.

**Light mode is the default.** The scene is a field rep or shop owner on a phone or laptop in a brightly lit shop, during the day.

## Type

- **Anek Latin** (variable: `wght` 100–800, `wdth` 75–125) for everything, from Ek Type, an Indian foundry.
- **Anek Devanagari** is next in the font stack, so Hindi text renders in the same family.
- **Display:** condensed (`font-condensed`, `wdth` 75), weight 800, leading 0.9, tracking -0.02em, max 6rem. It reads like painted signboard lettering.
- **UI and body:** normal width, 400/500/600, 16px base, measure 65–75ch.
- Phone numbers, quantities, prices and paths use `tabular-nums`.

## Logo

`<Logo />` (`src/components/logo.tsx`) is a keypad mark plus a wordmark.

- **Mark:** a 3×3 phone keypad. Keys 3·6·2·4 are lit, because on a phone keypad F=3, M=6, C=2, G=4, so the mark *dials* F‑M‑C‑G. Lit keys are ink; unlit keys are signal yellow on neutral grounds and a 15% ink tint on yellow surfaces (`surface='signal'`).
- **Wordmark:** `FMCG VOICE` in Anek condensed, with **FMCG** at 800 and **VOICE** at 500.
- **Size:** set it with font-size; the mark is 1.2em square.
- **Motion:** inside a hovered or focused link, the lit keys light up in dialling order (3 → 6 → 2 → 4, 140ms apart). There is no motion when reduced motion is on.
- **Favicon** (`src/app/icon.svg`): the keypad on a yellow tile.
- **Don't:** put the logo on a plate or badge, or add waveform bars.

## Shape and depth

- One radius: `--radius: 0.375rem` (signboards are rectangles; pills only for small status chips).
- Elevation is a border **or** a soft offset shadow, never both.

## Motion

- **Motion verb:** *a line going live / going dead.* Voice activity shows as waveform bars; endings collapse into a flat line.
- **Library:** GSAP (`useGSAP`), with one authored moment per screen.
- **Eases:** `expo.out` for settling, `sine.inOut` for voice activity.
- Content is visible by default. Animation never hides text or controls.
- When `prefers-reduced-motion: reduce` is set, the final state renders immediately.

## Browser surfaces

Text selection is signal yellow with ink text, and inverts on yellow surfaces. Focus is a 2px outline offset by 2px (ink on yellow, `--ring` elsewhere). The scrollbar is tinted from ink.
