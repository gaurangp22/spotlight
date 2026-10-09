---
name: Riffs
description: Music opinions and the people who get them — designed the way Apple would build a social app.
colors:
  light: { bg: "#F2F2F7", surface: "#FFFFFF", fill: "#EEEEF2", text: "#000000", secondary: "#6C6C70", tertiary: "#AEAEB2", accent: "#D9124B", accent-fill: "#E8174A", on-accent: "#FFFFFF" }
  dark: { bg: "#000000", surface: "#1C1C1E", fill: "#2C2C2E", text: "#FFFFFF", secondary: "#98989F", tertiary: "#636366", accent: "#FF4D74", accent-fill: "#E8174A", on-accent: "#FFFFFF" }
  brand-gradient: ["#FF2D55", "#AF52DE"]
  scores: { loved: "#1E9E4A", fine: "#D97A00", nope: "#D93025" }
  icon-tiles: { purple: "#AF52DE", pink: "#FF2D55", teal: "#0FA3B1", orange: "#FF9500", blue: "#007AFF", red: "#FF3B30", green: "#34C759", grey: "#8E8E93", indigo: "#5856D6" }
typography:
  family: "Inter (closest open face to SF Pro; same on iOS, Android, web)"
  largeTitle: { fontSize: "34px", fontWeight: 700, lineHeight: "41px", letterSpacing: "-1px" }
  title1: { fontSize: "28px", fontWeight: 700, lineHeight: "34px" }
  title2: { fontSize: "22px", fontWeight: 700, lineHeight: "28px" }
  title3: { fontSize: "20px", fontWeight: 600, lineHeight: "25px" }
  headline: { fontSize: "17px", fontWeight: 600, lineHeight: "22px" }
  body: { fontSize: "17px", fontWeight: 400, lineHeight: "24px" }
  callout: { fontSize: "16px", fontWeight: 400, lineHeight: "21px" }
  subhead: { fontSize: "15px", fontWeight: 400, lineHeight: "20px" }
  footnote: { fontSize: "13px", fontWeight: 400, lineHeight: "18px" }
  caption: { fontSize: "12px", fontWeight: 500, lineHeight: "16px" }
rounded: { xs: "6px", sm: "10px", md: "14px", lg: "20px", xl: "28px", pill: "999px" }
spacing: { xxs: "4px", xs: "6px", sm: "8px", md: "12px", lg: "16px", xl: "20px", xxl: "28px", xxxl: "40px", gutter: "20px", max-content: "680px" }
---

# Riffs design system

## North star

**What would it look like if Apple made a social app for music?** Riffs follows Apple’s Human Interface Guidelines: quiet chrome, system grouped backgrounds, one accent, generous spacing, and album art supplying the colour. It should sit on a home screen next to Music, Messages, and Photos and feel like it belongs.

Tokens live in `src/ui/theme.ts`; primitives in `src/ui/primitives.tsx`; the screen scaffold, feed cards, and score badge in `src/ui/components.tsx`; social pieces (feed switcher, takes, polls, taste match, friends’ rail) in `src/ui/equals.tsx`; the tab bar in `src/ui/tabbar.tsx`. Screens compose these and never hard-code colours.

## Appearance

- **Light and dark follow the device**, like every Apple app. Light uses the grouped background `#F2F2F7` with white cards; dark uses true black with `#1C1C1E` cards.
- **One accent: Riffs Rose.** Music apps own warm red-pink. It marks primary actions, selection, likes, and links. Accent text and white-on-accent fills are contrast-checked (≥ 4.6:1).
- **Brand gradient** (rose → purple) is rare and celebratory: the app icon, the signed-out welcome, the taste-match card, the “Rate it” tile, and the glow ring on friends who posted today.
- **Icon tiles are Settings-style:** a solid system colour (purple, pink, teal, orange, blue, red, green, grey, indigo) with a white glyph.
- **Scores** use green / orange / red rounded squares with white bold numerals.

## Type

Inter on the iOS Dynamic Type scale (Large). Large titles (34 bold) open every tab root and collapse into the navigation bar on scroll. Body is 17pt. Counts use tabular figures. Text respects the system size up to 1.6×.

## Layout and surfaces

- One column, 20pt gutters, capped at 680pt; tablets get a side rail.
- Cards: 20pt continuous corners, soft wide shadow in light mode, no border; elevation in dark mode comes from the lighter surface.
- Grouped lists (`ListGroup` + `ListRow`) for settings-like content, with inset separators.
- The **floating glass tab bar** (iOS 26 style): a frosted capsule of four destinations — Home, Discover, Messages, Profile — with a separate round glass **+** button for creating, as Apple Music separates Search.
- Primary buttons are filled rounded rectangles (14pt corners); small actions are capsules.

## Components

| Component | Use |
|---|---|
| `Screen` | Every route: safe areas, collapsing large title, pull-to-refresh, pinned footer, tab-bar spacing. |
| `Button` | `primary` (rose fill), `secondary` (grey fill), `tinted`, `plain`, `danger`, `inverse`; `lg` / `md` / `sm`. |
| `Segmented` | The iOS segmented control: grey track, raised thumb. Used for For you / Following. |
| `SearchField` | The iOS search bar. |
| `Chips` | Filter capsules; the selected one is filled with the text colour. |
| `ListGroup`, `ListRow` | Inset grouped lists with Settings-style icon tiles. |
| `EmptyState` | Apple’s content-unavailable layout: large grey symbol, title, description, action. |
| `ReviewCard`, `TakeCard`, `PodCard` | Feed units with the shared action row: like, reply, send to a friend, share. |
| `ScoreBadge` | Tier-coloured rounded square with the score. |
| `BotBadge` | A small grey “BOT” chip after any house bot’s name, everywhere it appears. |
| `MatchCard`, `StoryRail` | Taste match (gradient card, big percentage) and friends’ latest picks (avatars with a glow ring). |

## Motion and feedback

Springy press-scale on every tappable surface, haptics on meaningful actions, sliding segmented thumb, 150–400 ms transitions that never block input.

## Do / don’t

- Do let artwork carry colour; keep chrome neutral and follow the system appearance.
- Do label every bot, every example, and every device-only draft honestly.
- Don’t add accent colours for UI state, tilt or rotate elements for decoration, or use monospace or all-caps for buttons.
- Don’t copy another app’s brand identity (Apple Music’s logo, names, or artwork); follow the platform conventions instead.
