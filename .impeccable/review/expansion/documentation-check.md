# Riffs expansion documentation comparison

Date: 2026-10-08. Scope: ordinary extension of the incumbent Riffs system. Documentation requirement: complete for the evidenced web scope.

## Authority and preservation

Read `PRODUCT.md`, incumbent `DESIGN.md`, `.impeccable/design.json`, `direction.md`, and Impeccable's `reference/document.md`. Product and direction explicitly retain the existing dark visual world and exclude audio and a Spotify API dependency from the new flows. This is a comparison pass, not a design-system refresh. No creative language, tokens, component examples, standing workflow defaults, or brand assets were replaced.

`DESIGN.md` and `.impeccable/design.json` were preserved byte-for-byte during this pass. Their SHA-256 values are respectively `3D3FC26ACAB30515C69EA8910B880A0D4E2DA18FBEFE11ECF034A20A944D71C3` and `BBB2F3E2AE6687BE484D954943557F47B3208ED71C4720D7511F9343F1ADEC71`. Their existing working-tree status is not a change made by this documenter. The only file written by this pass is this comparison record.

## Implemented extension against the incumbent system

| Area | Comparison and finished behavior |
|---|---|
| Palette, typography and shapes | `src/ui/theme.ts` matches the documented black/charcoal palette, coral actions with black labels, Archivo Black/Inter/Space Mono roles, radius scale, spacing scale, 20-point gutter and 680-point maximum measure. The supplied phone and desktop captures retain that world. No new raster asset is required or introduced by this extension. |
| Shared controls and layout | `src/ui/primitives.tsx` retains large/medium/compact button minimum heights of 52/48/48 points and existing rounded cards, fields, selected tabs, busy/disabled states and named actions. `src/ui/components.tsx` retains safe-area structure and a footer outside the scroll area, and adds scroll observation needed for conversation continuity. Desktop captures show the same centered content measure. |
| Inbox and conversation creation | `src/app/messages/index.tsx` composes the incumbent Card, ListRow, Segmented, SearchField and TextField. Direct/group choices, named group, visible participant selection, inbox preview and unread count are present. Recipient rows expose checkbox roles, checked states and selected/unselected labels; the inbox accessible name includes unread information. |
| Conversation continuity | `src/app/messages/[id].tsx` uses a pinned shared footer for text/music composition. Initial opening, incoming messages near the bottom, and sent messages reveal the latest message above the composer. Earlier pages preserve the reader's anchor. Incoming messages while reading older content preserve the position and expose the explicit Jump to latest action. Music/post attachments, own-message removal, other-message report and group leave/removal actions use existing primitives. |
| Playlist source and review | `src/app/import-playlist.tsx` clearly distinguishes an attached Spotify/Apple Music source from imported tracks. Pasted lines/CSV match through the catalog with Spotify disabled; public Deezer picks use the playlist provider path. Matched picks can be reviewed, skipped, chosen from candidates or added with search before publishing a visibility-controlled pod. The pinned completion action follows the existing composer/action layout. |
| Manual private diary | `src/app/history.tsx` calls the surface Listening diary and states that listeners choose what to log; it does not imply external playback tracking. Music rows, empty state, pagination, retry and the clear confirmation reuse incumbent components. |
| Preferences and email verification | `src/app/account-preferences.tsx` groups message preference, phone alerts and email ownership in familiar charcoal cards. Copy explains web/native and server-provider availability. The signup surface in `src/app/auth.tsx` exposes the purpose-bound verification code when configured, with resend state and the incumbent pinned account-creation action. |
| Personalized paged feeds | `src/app/(tabs)/index.tsx` retains the existing For You/Following hierarchy and opinion cards, and explains artists, ratings, manual diary and follows as the inputs. `src/ui/pages.ts` scopes cursor state to the viewer/query. The source and supplied feed capture introduce no machine-learning claim or external playback dependency. |

## Evidence checked

Visually inspected every supplied expansion capture: `inbox-mobile.png`, `inbox-desktop.png`, `group-create-mobile.png`, `thread-mobile.png`, `thread-desktop.png`, `thread-older-mobile.png`, `message-report-mobile.png`, `playlist-mobile.png`, `playlist-review-mobile.png`, `playlist-desktop.png`, `diary-mobile.png`, `preferences-mobile.png`, `signup-mobile.png`, and `feed-mobile.png`. The phone captures are 390x844; desktop captures are 1440x960.

Read `qa-results.json`: it records two-account messaging/unread/replies/polling, music attachments and removal, group selection/leave/ownership transfer, manual diary, pasted CSV/source publication, adapter-based Deezer import, preferences, cursor feed, synthetic signup email, post sharing/visibility and message reporting. It reports no page or console errors.

Read the latest `messaging-fix-results.json`: all eight targeted assertions cover latest positioning, incoming follow, sent-message visibility, earlier-page anchoring, preserved older reading and Jump behavior, accessible recipient selection and inbox unread labeling. It reports no page or console errors. Read `finish-verdict.md`, which marks the two scored corrections resolved and returns `ship` for the supplied web evidence.

This comparison inspects the recorded evidence and source; it does not claim an additional independent browser test run. The QA harness uses an isolated memory API, synthetic accounts/email delivery and deterministic catalog/provider adapters. Native permissions, push credentials/delivery, gestures/video and real Resend delivery remain unverified. No deployment or store release is claimed.

## Retained documentation drift, reported without repair

- `DESIGN.md` Layout still describes For You as recent visible community content. The current extension uses a deterministic personalized cursor feed from the viewer's Riffs artists, ratings, manual diary and follows, with recent content for an empty profile. This is stale behavior prose in retained documentation; the visual hierarchy and tokens still match. This record captures the current behavior without refreshing the incumbent file.
- The incumbent sidecar's narrative is a summary rather than the verbatim Overview/Do's and Don'ts mapping described by `reference/document.md`. This mismatch was present on entry to this pass; it was left intact.
- The incumbent sidecar's Music status input is an approximate sample (14px input text, 1px border, 14px padding and a 2px focus outline). Shared `TextField` uses the body type (16px), a 1.5-point border, 14-point horizontal/13-point vertical padding and border-color focus treatment. The sample is not an exact extraction of that primitive. This pre-existing documentation approximation was not repaired or promoted into new tokens.

No new visual-world divergence requiring a design-system rewrite was found in this extension. The ordinary-extension documentation comparison is complete; retained documentation drift is explicitly recorded above for a future authorized refresh.
