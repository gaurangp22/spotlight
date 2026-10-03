---
name: MARGIN
description: Music opinions expressed as an editorial program log.
colors:
  paper: "#F3F0E8"
  ink: "#1A1A18"
  muted: "#66655F"
  line: "#CECBC2"
  accent: "#C3432E"
  accent-dark: "#A33323"
  white: "#FFFDF7"
  soft: "#E8E4DA"
  night: "#282C2C"
  cream: "#E8D5B8"
typography:
  headline:
    fontSize: "38px"
    fontWeight: 900
    lineHeight: "40px"
    letterSpacing: "-1.8px"
  featured-title:
    fontSize: "31px"
    fontWeight: 900
    lineHeight: "34px"
    letterSpacing: "-0.8px"
  title:
    fontSize: "22px"
    fontWeight: 900
    letterSpacing: "-0.7px"
  music-title:
    fontSize: "15px"
    fontWeight: 800
  body:
    fontSize: "14px"
    fontWeight: 400
  metadata:
    fontSize: "12px"
    fontWeight: 400
  label:
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "1.8px"
  action:
    fontSize: "14px"
    fontWeight: 800
    letterSpacing: "0.3px"
rounded:
  square: "0px"
spacing:
  gap-small: "8px"
  gap-action: "10px"
  gap-row: "12px"
  panel: "18px"
  page: "20px"
  scroll-end: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.square}"
    padding: "0px 18px"
  button-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.square}"
    padding: "0px 18px"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0px 14px"
    height: "52px"
  ranking-preview:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "{spacing.panel}"
  ranking-featured:
    backgroundColor: "{colors.night}"
    textColor: "{colors.white}"
    rounded: "{rounded.square}"
    padding: "{spacing.page}"
  choice-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.square}"
  navigation:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
---

## Overview

**Creative North Star: "The Radio Program Log"**

MARGIN is a working identity for an Android-first local music prototype. The visual world borrows the order, numbering, and confident typography of a radio track sheet. Warm paper and dark listening surfaces frame music artwork; expressive headlines invite people to put their own taste into words and order.

**Key Characteristics:**
- Editorial and culture-driven.
- Artwork supplies the changing color.
- Indexed choices make the opinion legible.
- Flat, square, confident controls.

This documents the implemented prototype, not a claim of user approval or production readiness. Sources: `src/ui/theme.ts`, `src/ui/components.tsx`, and `src/app/`. Phone-size web smoke evidence showed ranking detail and editor rendering; no emulator or Android hardware screenshots were available. System Back, insets, keyboard behavior, font scaling, accessibility, motion settings, performance, and native image sharing still require device verification.

## Colors

Primary: **accent**, a burnt radio-orange, marks main actions, ranking numbers, selected outlines, and occasional headline emphasis. **accent-dark** supports search error copy.

Neutral: **paper** is the page canvas; **white** is the lighter preview/input surface; **soft** groups prompts and editing areas. **ink** carries primary text and strong rules; **muted** carries context; **line** separates rows. **night** creates a listening surface, with **white** titles and **cream** secondary text. Artwork colors and its fallback color belong to the music item.

**The Artwork Color Rule.** Let cover art carry variety. Keep interface color anchored to the established palette.

Night panels and the Night share template are composed variants of the light interface. They are not evidence of a complete Android system dark theme or Dynamic Color support.

## Typography

Use the native default sans-serif; no custom font family is configured. On Android, preserve the system text behavior. The frontmatter records reusable observed roles, expressed as CSS lengths for portable tooling; implementation values are React Native logical units, with font sizes following native text scaling.

Headlines use heavy weight and tight tracking. Their observed screen range is (33–42), with close line heights. Preview titles are compact (23/26); featured previews expand to (31/34). Titles and music names stay bold; artist/context copy stays smaller and quieter. Uppercase, tracked eyebrows and metadata provide the track-sheet cadence. Keep long titles flexible and retain the source's truncation only in compact music rows and share previews.

## Layout

Compact Android phones are the shipped target. Pages use one scrolling column, page gutters (20), and bottom content padding (28). Headers are (58) tall. Common row gaps are (8–12); preview padding is (18), featured padding (20). Full-width dark hero panels deliberately extend through the page gutters.

Rankings are ruled lists: position, square artwork, title/artist, then a trailing action. Standard music rows have minimum height (70); editor rows use (108) to accommodate two stacked reorder controls. Comparison uses two equal columns; share cards cap at width (340) and show up to five picks.

Keep interactive targets at least (48×48 dp) and separate adjacent targets by (8 dp). Source controls mostly use this geometry; the web smoke pass does not certify native target bounds. Tablet navigation and expanded layouts are not established. Verify status/navigation bars, display cutouts, IME, system Back, and font scale on Android before extending the target list.

## Elevation & Depth

**The Ruled Surface Rule.** Establish hierarchy with tonal blocks and horizontal rules, without decorative shadows.

The implementation has no shadow vocabulary. Thin rules (1) divide items; heavier rules (2) establish sections and preview tops. A dark featured preview starts with an accent rule. Tonal contrast supplies depth without gradients or glass.

## Shapes

Buttons, fields, artwork, preview containers, and share cards are square. Circular initial avatars are the intentional exception, with radius half their size. Preserve actual cover-art framing; do not add rounded artwork tiles as decoration.

## Components

- **Actions:** Primary uses accent/white; secondary uses an ink outline and ink text. Minimum height (50), horizontal padding (18), icon gap (10). Pressed opacity is (0.75); disabled opacity is (0.4). No custom hover/focus treatment is implemented for native.
- **Header:** Heavy screen title, optional back action, optional trailing action; a thin bottom rule provides context. Navigation uses Expo Router.
- **Navigation:** Four labeled destinations—Following, Discover, Create, You—on a dark bottom bar. Active labels/icons are white; inactive color is subdued. Icons are MaterialCommunityIcons. Source bar minimum height is (66); native inset handling remains to be verified.
- **Search and editor fields:** White rectangular search field with leading magnifier and muted placeholder. The editor's headline is a large multiline input on paper; optional context ends with a thin rule. Source has no custom focus/error border state.
- **Choice controls:** Outlined Songs/Albums and visibility choices become ink-filled with white text when selected. Share template selection uses an accent outline. Agree becomes accent-filled and shows a check plus “Agreed”. Selection must remain legible through text/icon changes where implemented.
- **Ranking preview:** Author/date and example marker, heavy title, a few numbered artwork rows, then picks/reactions and a directional arrow. Regular previews show two items; the dark featured preview shows three. This is an editorial ranking excerpt, not a generic social card.
- **Music row:** Two-digit orange position, square cover, bold title, muted artist/context, and optional trailing control. Artwork failure produces a title-based fallback on the music item's color or night surface.
- **Battle and comparison:** Battle choices are dark artwork-led surfaces; progress is a flat accent bar. Comparison aligns the two ordered lists and reports the largest split. Preserve the informational role of each number.
- **Share card:** Paper and Night variants retain masthead, title, indexed music, artwork, and footer. Native capture/share is implemented but unverified on Android hardware.

## Do's and Don'ts

### Do:
- **Do** let artwork lead the changing color and music identity.
- **Do** use positions, rules, and typography to make rankings immediately readable.
- **Do** preserve native text scaling, system Back, window insets, and Android touch targets.
- **Do** visibly label sample people/posts and device-local prototype behavior.

### Don't:
- **Don't** add gradients, glass, decorative shadows, or generic rounded-card feeds.
- **Don't** copy the visual identity of an existing music or ranking app.
- **Don't** treat web phone-size screenshots as Android device evidence.
- **Don't** claim a complete dark theme, tablet system, or accessible native experience without verification.
