---
name: MARGIN
description: Music opinions, presented with first-party polish.
colors:
  light:
    bg: "#F7F5F1"
    surface: "#FFFFFF"
    fill: "#EFECE6"
    text: "#121211"
    secondary: "#6B6862"
    tertiary: "#A3A09A"
    accent: "#C63A22"
    accent-fill: "#C63A22"
    danger: "#C4281C"
  dark:
    bg: "#0E0E0F"
    surface: "#1A1A1C"
    fill: "#262628"
    text: "#F5F3EE"
    secondary: "#A09D97"
    tertiary: "#6C6A66"
    accent: "#FF6B4A"
    accent-fill: "#D44129"
    danger: "#FF5B4F"
typography:
  family: "Inter"
  display: { fontSize: "40px", fontWeight: 800, lineHeight: "44px", letterSpacing: "-1.4px" }
  large-title: { fontSize: "34px", fontWeight: 700, lineHeight: "40px", letterSpacing: "-1px" }
  title1: { fontSize: "28px", fontWeight: 700, lineHeight: "34px", letterSpacing: "-0.7px" }
  title2: { fontSize: "22px", fontWeight: 700, lineHeight: "28px", letterSpacing: "-0.45px" }
  title3: { fontSize: "19px", fontWeight: 600, lineHeight: "25px", letterSpacing: "-0.3px" }
  headline: { fontSize: "16px", fontWeight: 600, lineHeight: "21px" }
  body: { fontSize: "16px", fontWeight: 400, lineHeight: "23px" }
  subhead: { fontSize: "14px", fontWeight: 400, lineHeight: "19px" }
  footnote: { fontSize: "13px", fontWeight: 400, lineHeight: "18px" }
  caption: { fontSize: "12px", fontWeight: 500, lineHeight: "16px" }
  overline: { fontSize: "11px", fontWeight: 600, letterSpacing: "0.9px", textTransform: "uppercase" }
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "28px"
  xxxl: "40px"
  gutter: "20px"
  max-content: "680px"
---

## North star

**Feels first-party.** MARGIN should sit on a home screen next to the system’s own apps and not look out of place: calm surfaces, confident type, generous spacing, and motion that responds to touch rather than decorating it. Music artwork supplies the colour; the interface stays quiet so opinions stand out.

The implementation lives in `src/ui/`: tokens in `theme.ts`, primitives in `primitives.tsx`, screen scaffolding in `components.tsx`. Screens compose these and never hard-code colours.

## Colour

- **Warm neutrals, one red.** The canvas is warm off-white (dark: near-black); content sits on white (dark: charcoal) cards. The brand red is reserved for primary actions, selection, and the top of a ranking.
- **Two accent tokens.** `accent` is for text and icons; `accentFill` is for filled controls. In dark mode they differ, so red text stays legible on dark surfaces while white-on-red buttons keep their contrast.
- **Contrast is checked, not guessed.** Body text pairs meet WCAG AA (≥ 4.5:1) in both themes. `tertiary` is for placeholders and decoration only.
- **Artwork leads.** Hero areas use the cover art itself, blurred, under a dark scrim — so every post looks different without any new interface colours.

## Typography

Inter, loaded at launch behind the splash screen, at five weights. Use the named variants on `<T v="…">`, never raw font sizes. Large sizes carry negative tracking; numbers that line up (ranks, counts, scores) use tabular figures. Text respects the system font size up to a 1.6× cap so layouts don’t break.

## Layout

- One column, 20 pt gutters, content capped at 680 pt and centred on wide screens; tabs move to a side rail at tablet widths.
- **Large titles** sit at the top of tab roots and list screens and collapse into the navigation bar as you scroll; a hairline appears under the bar only once content scrolls beneath it.
- **Inset grouped lists** (`ListGroup` + `ListRow`) for settings-like content, with coloured icon tiles and inset separators.
- Primary actions that complete a flow (Publish, Share, Send) are pinned in a footer above the keyboard and safe area.

## Shape & depth

Continuous-curve corners (`borderCurve: continuous` on iOS): 20 pt cards, 14 pt buttons and fields, 28 pt hero panels and dialogs. In light mode cards float on a soft, low shadow; in dark mode shadows are replaced by a hairline border. No glass, no decorative gradients — the only gradient is the scrim that keeps text readable over artwork.

## Motion & feedback

- Every tappable surface springs down slightly on press (`Tap`) and gives a light haptic tick; primary actions use a firmer one, successes a success notification, errors a warning.
- Segmented controls slide their thumb with a spring; list reorders animate with layout transitions; feeds fade up in a short stagger.
- Animation is short (150–400 ms) and never blocks input.

## Components

| Component | Use |
|---|---|
| `Screen` | Every route. Safe areas, collapsing large title, pull-to-refresh, pinned footer, keyboard avoidance. |
| `Button` | `primary`, `secondary`, `tinted`, `plain`, `danger`, `inverse`; `lg` / `md` / `sm`; loading state built in. |
| `IconButton` | Circular icon actions with optional badge and a guaranteed 44 pt hit target. |
| `Card` | The grouping surface. Pressable cards scale on touch. |
| `Segmented` | Mutually exclusive choices (visibility, Songs/Albums, share template, Posts/Drafts). |
| `TextField`, `SearchField` | Labelled inputs with focus and error states. |
| `ListGroup`, `ListRow` | Settings-style lists and secondary actions. |
| `Sheet`, `Dialog` | Full-height pickers and confirmations; destructive confirmations use the solid danger button. |
| `RankingCard` | The feed unit: author, title, and a podium of the top three covers. |
| `MusicRow`, `Artwork` | Indexed music with cover art and a typographic fallback when art is missing. |
| `Toast` | App-wide notices, announced to screen readers, dismiss on tap or after five seconds. |

## Do

- Let artwork carry colour; keep chrome neutral.
- Say what’s blocking a disabled action (e.g. “Add at least two picks to publish”).
- Label examples and device-only drafts honestly.
- Keep touch targets ≥ 44 pt and every icon-only control labelled.

## Don’t

- Hard-code colours or font sizes in screens.
- Add new accent colours for UI state — use the existing tokens.
- Copy another music or ranking app’s visual identity.
