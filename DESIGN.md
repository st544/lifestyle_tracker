# DESIGN.md

> Aesthetic + animation principles. Read this before adding new screens or components so they feel like they belong.

## North star

A **dark, focused, tactile training tool** with **Zelda-inspired celebration moments**. The day-to-day UI is calm and high-contrast; rare events (streak milestones, big load jumps) trigger genuine joy via Triforce gold, particles, and "item get" overlays.

The user opens this app multiple times a day. The constant micro-feedback (haptics + press scale + count-ups) creates a steady drip of satisfaction. The rare big celebrations create memorable peaks.

## Color system

Everyday colors live in `src/theme.ts` under `colors`. They are **calm** — no neons, no rainbows. Activity types use distinct hues so the Calendar's multi-dot view is glance-readable.

| Surface | Hex | Use |
|---|---|---|
| `bg` | `#0B0F14` | App background |
| `surface` | `#141A22` | Cards |
| `surfaceAlt` | `#1B232E` | Inputs, recessed surfaces |
| `border` | `#222C38` | 1px borders |
| `text` | `#F2F4F7` | Primary text |
| `textDim` | `#9AA4B2` | Secondary text |
| `textFaint` | `#6B7480` | Tertiary |
| `primary` | `#4F8CFF` | Brand accent (Lift color too) |

Activity tints (in `typeColors`):

- BJJ `#FF6B3D` · Lift `#4F8CFF` · Run `#5DF87A` (light neon green) · Climb `#A78BFA` · **Hiking `#228B22`** (forest green, darker/distinct from Run; icon `footsteps`) · Sauna `#F59E0B` · Plunge `#22D3EE` · Mobility `#2DD4BF` · Rest `#64748B`

### Zelda palette (`src/theme.ts` → `zelda`)

Reserved for **celebration moments only**. Don't use these in normal UI chrome — that dilutes the magic.

| Token | Hex | Use |
|---|---|---|
| `triforceGold` | `#FFD23F` | Item-get, milestones, save checkmark ring |
| `triforceGoldDeep` | `#B8860B` | Outlines on triforce shapes |
| `rupeeGreen` | `#00B86B` | Particle bursts (basic rupee) |
| `rupeeBlue` | `#2EA8FF` | Particle bursts |
| `rupeeRed` | `#E53935` | Particle bursts |
| `rupeePurple` | `#A459FF` | Particle bursts |
| `rupeeSilver` | `#C0C7D1` | Particle bursts |
| `rupeeGold` | `#FFC83F` | Particle bursts |
| `heartRed` | `#FF4D6D` | (reserved for future health-style indicators) |
| `skyTeal` | `#6FDDD9` | BotW magical glow accent, light-zone hero gradient |
| `magicGlow` | `#C6F9FF` | Reserved for future glow/halo effects |
| `parchment` | `#F4E5C2` | Reserved for future "scroll" surfaces |

`rupeePalette` is the array cycled through by `TriforceBurst` particles.

## Animation philosophy

### Three tiers of motion

**Tier 1 — Constant micro-feedback (every touch, every screen open)**
Cheap, near-invisible, but cumulative. If you remove these the app feels dead.
- `Pill`, `QuickAddBar` button, `SessionCard`: press-in scale → 0.92–0.97, press-out spring back, `haptics.tap()` on press.
- All numeric values that can change: `AnimatedNumber` with 500–900ms count-up.
- All screen entries: `FadeInView` with staggered delays.
- Active tab: `AnimatedTabIcon` bounces on focus.

**Tier 2 — Earned moments (every save, every refresh)**
Slightly bigger payoffs for normal user actions.
- Save session: button morphs into `SaveCheckmark` (golden ring draws in, check strokes in), `TriforceBurst` fires from the button, `haptics.success()`.
- Pull-to-refresh on Today: if projected weekly % went up since last open, trigger a burst + success haptic.
- Mark planned → completed: burst + success haptic.
- LoadBar zone transition (Light → Moderate, etc.): 200ms opacity pulse in the new zone's color.
- Smart message typewriter on Today open.
- Hero count-up: weekly % counts from 0 → current over 900ms.

**Tier 3 — Rare jackpots (genuine milestones)**
Should be uncommon enough to remain special.
- `CelebrationOverlay` for streak milestones (4/12/26/52 consecutive weeks of hitting a goal). Modal with rotating dashed ring, Triforce icon, particles, "ACHIEVEMENT UNLOCKED" eyebrow, success haptic.

### Easing defaults

- Standard fades and translates: `Easing.out(Easing.cubic)` for entries, `Easing.in(Easing.cubic)` for exits.
- Springs for press-out, scale-bounce, tab icon: `damping: 8–12, stiffness: 200–320`. Lower damping for celebration springs (more wobble).
- Count-up: 700–900ms feels alive without being slow. Faster = unnoticeable; slower = annoying.

### Stagger pacing

Card cascades on screen open use 60–80ms increments. Too tight feels chaotic; too loose feels sluggish. (Calendar streak chips no longer use a scale/move "ignition" — they carry a continuous gradient sheen in the activity color instead.)

### Performance rules

- Animate styles via `useAnimatedStyle` (UI thread), never via setState in a loop.
- `AnimatedNumber` uses the TextInput-animated-text trick to avoid React re-renders mid-tween.
- `TypewriterText` uses JS setInterval — fine for ≤ 200 char strings. For long strings, switch to a sharedValue + animatedProps approach.
- `TriforceBurst` mounts ~18–26 particles. Don't go past 40 without testing on a midrange Android.
- Linear gradients can be expensive on Android. Only one per screen (hero card).

## Typography

- Display headlines: `fontSize.display` (34), weight 800/900, `letterSpacing: -0.5`
- Section titles: `fontSize.lg` (17), weight 700
- Body: `fontSize.md` (15)
- Meta labels: `fontSize.xs` (11), weight 700, `letterSpacing: 0.4`, often `textTransform: uppercase` for that "HUD" feel

## Layout

- Card padding: `spacing.md` (12)
- Card border-radius: `radius.lg` (16)
- Pill radius: `radius.pill` (999)
- Section vertical rhythm: `spacing.md` gap between cards, `spacing.lg` between sections
- Container padding: `spacing.lg` (16) horizontal, `spacing.sm` (8) top

## Iconography

- Ionicons throughout (no other icon library).
- Activity icons are in `typeIcons` — flame for BJJ, barbell for Lift, walk for Run, etc.
- Reserve `flame` (filled) for **active streaks**. Inactive streak chips use the activity's own icon instead.

## Sound (future)

`src/sounds.ts` is a stub. The Zelda direction calls for:
- `playItemGet()` on `CelebrationOverlay` open (item-get jingle)
- `playRupee()` on each particle batch in `TriforceBurst` (small ding)
- `playSecret()` on streak ignition / pull-to-refresh celebration
- `playChestOpen()` on hero gradient transition into a new zone

Drop short, royalty-clean chimes into `assets/sounds/` and wire them up with `expo-audio` (bundled with SDK 54). Keep clips ≤ 1s.

## Don't-do list

- No emojis as core UI elements (the user didn't ask for them and they'd clash with the Zelda restraint).
- No rainbow gradients. The hero gradient shifts subtly by zone color only.
- No screen-wide background animations (too much motion behind content fatigues).
- No confetti — `TriforceBurst` is the Zelda-equivalent and we should commit to it over generic celebration libraries. (We added `react-native-confetti-cannon` to package.json as a fallback, but unused so far.)
- No motion on text that the user is reading. The typewriter is the only exception, and it runs once on open.

## Accessibility

- Press targets ≥ 44pt on any tappable.
- Color contrast: tested against `colors.text` on `colors.surface`; meets WCAG AA.
- All animations respect that they should still leave the final state visible if the animation is interrupted (i.e. don't gate content visibility on the animation completing).
- Future: respect `AccessibilityInfo.isReduceMotionEnabled()` and skip Tier-3 celebrations / shorten Tier-1 counts. Not implemented yet — flagged in ROADMAP.
