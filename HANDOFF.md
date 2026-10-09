# Riffs 2.0 handoff

## Apple-style redesign, house bots, phone testing — 9 October 2026 (later)

Read this first; the sections below remain accurate for everything else.

**Design.** The owner rejected both the dark coral/Archivo theme and an interim neon "Afterglow" exploration. They asked for "what Apple would make as a social app", so Riffs now follows Apple's Human Interface Guidelines. See `DESIGN.md`.
- Light and dark mode follow the device.
- Inter on the iOS type scale.
- One rose accent, plus a rose-to-purple brand gradient used sparingly.
- Settings-style solid icon tiles, the iOS segmented control and search bar, and content-unavailable empty states.
- An iOS 26-style frosted floating tab bar (Home, Discover, Messages, Profile) with a separate + button. Messages is now a tab (`src/app/(tabs)/inbox.tsx`).
- Home and Create were rebuilt for hierarchy; the feed cards were rebuilt artwork-first, with like / reply / send / share.
- New gradient app icon and splash: `scripts/generate-icons.cjs`.
- Removed font packages: Archivo Black, Space Mono, Bricolage, Geist. Added `expo-blur`, a native module, so a new build is needed.

**House bots** (`server/bots.mjs`, enable with `RIFFS_BOTS=1`).
- Six labelled personas post real catalog music (reviews, takes, polls; 8 a day by default).
- They like, vote on, and sometimes reply to real people's recent public posts: always on someone's first few posts, at most two replies a day per person.
- Riffs Radio follows new members.
- They act only through the public API, so visibility, block, and validation rules apply to them. Bot accounts can't be signed into.
- A **BOT** badge appears everywhere. People can hide bots (preference `bots`, column `show_bots`). Bots are excluded from founder stats and disclosed in `server/legal.json`.
- New schema: `users.is_bot` and `users.show_bots`, plus a `bot_actions` table. All are additive migrations.

**Phone testing.** `npm run build:dev` once, then `npm run phone` for live reload. `npm run phone:web` opens the app in a phone browser on the same Wi-Fi; development CORS now accepts private-LAN origins, and production is unchanged and tested. `npm run update:preview` pushes JavaScript changes over the air to installed preview builds. README: "Testing on your phone without reinstalling".

**Verification.** Typecheck and lint clean. `npm test`: 53 API tests (4 new for bots, 1 for LAN origins) plus the core checks. Home, Create, Profile, Discover and post detail were checked in light and dark mode at 390×844 on an isolated QA server with bots running live against the real Apple catalog. Native blur, camera, and push are still unverified on devices.


## Beta readiness — 9 October 2026

Read this first; the 8 October section below still describes everything else accurately.

**Product call.** The feature set already covers the Podiums and Equals loops, so no more features were added. This batch builds what a small real-user beta needs: a way for it to grow, a way to hear from testers, and a way to see whether anyone comes back.

| Added | Behaviour | Where |
|---|---|---|
| Invite links | Each person has a personal link. The API serves a public landing page at `/join/<handle>` (no app needed). The in-app `/join/[handle]` screen remembers the invite through signup; the new account follows the inviter, `users.invited_by` is set, and the inviter gets a `joined` notification. Unknown, malformed, and self invites are ignored, never a signup failure. Entry points: the Profile card (while following fewer than 10 people), Settings → *Riffs beta*, the empty Discover people list, and the onboarding follow step | `server/beta.mjs`, `src/app/join/[handle].tsx`, `src/lib/invite.ts`, `src/ui/invite.tsx` |
| Shared post previews | Post links (`postLink`) now point at `/p/<id>` on the API when `EXPO_PUBLIC_WEB_URL` isn't set, instead of a `marginmusic://` link that only works with the app installed. **Public posts only**; Open Graph tags give link unfurls a cover image | `server/beta.mjs` (`postLanding`), `src/lib/links.ts` |
| Cross-platform sharing | `shareLink()` uses the share sheet on phones, `navigator.share` or the clipboard on web, and a copy-this-link prompt if the clipboard is blocked (a raw browser error used to reach users) | `src/lib/links.ts` |
| Beta feedback | Settings → *Send feedback* (also when signed out). Stores the text, a topic, the screen it came from, platform, and app version. It's anonymous when signed out, rate limited to 10 per hour, and kept without the name when the account is deleted | `src/app/feedback.tsx`, `/api/feedback` |
| Founder metrics | `admin.mjs stats`: people, new this week, daily/weekly/monthly active, daily/monthly ratio, 7-day content counts, invite conversions, top inviters, and retention by signup week (next day / second week / a month later). Built from a new `active_days(user_id, day)` table, written at most once per person per day, plus existing content tables. No SDK; demo accounts excluded | `server/beta.mjs`, `server/admin.mjs` |
| Launch checklist | `npm --prefix server run preflight` fails while production config is unsafe: not NODE_ENV=production, a bad key, HTTP URLs or origins, no email delivery, demo bots on. It warns about the admin token, proxy trust, database location, and demo accounts still in the database | `server/preflight.mjs` |
| Privacy policy | `server/legal.json` (dated 9 October 2026) now discloses usage dates, invite attribution, feedback contents, aggregate founder counts, and public post previews. **Still needs legal review before launch** | `server/legal.json` |

**Verification.** `npm run typecheck` and `npm run lint` are clean; `npm test` passes all 48 API tests (5 new in `server/test/beta.test.mjs`), plus the core checks. In the browser, against an isolated QA API with a throwaway demo database (the owner's servers and data were not touched): a demo invite link opened the landing page, then the web join screen, then signup through the real form. The database then showed `invited_by`, the follow, the inviter's `joined` notification, and an activity day. Feedback was sent from the app and read back with `admin.mjs feedback`, `admin.mjs stats` printed real counts and cohorts, a public review rendered at `/p/<id>` with its cover, and the blocked-clipboard fallback was confirmed after the fix. A schema-migration test confirms older databases gain the new column and tables without losing people.

**Also fixed.** A migration crash when an old database had no `comments` table; the duplicate “Send feedback” row in Settings; `package.json` version aligned to 2.0.0.

**Recommended next steps (owner).**
1. Pick hosting and run `npm --prefix server run preflight` until it passes.
2. Set up Resend.
3. Run `npm run demo:clear`.
4. Make a native build.
5. Invite 10–20 people with your own links.
6. Each week, read `admin.mjs stats` and `admin.mjs feedback`. A healthy early sign is people returning in their second week; if they don't, fix that before adding features.

## Current handoff — 8 October 2026

This section is the authoritative current state for the next developer or AI session. The continuation notes and original Claude handoff below are historical; their MARGIN name, smaller test counts, old Spotify assumptions and completed-feature TODOs do not override this section.

### Product and owner decisions

- The app is **Riffs**, a music-first social app inspired by Equals and Podiums. The intended loop is sharing music opinions, discussing picks and finding people with similar taste.
- The owner and Ayush, whose nickname is Mandi, will register and create their own profiles. Do not generate personal accounts or identities for them.
- Email OTP is the chosen code-based sign-in method. Resend setup is deferred by the owner; real inbox delivery has not been tested.
- Keep audio playback disabled. The current feature batch does not depend on Spotify API credentials. Legacy optional Spotify code remains behind configuration.
- Preserve existing accounts, posts, drafts and local database data. Demo users/content must remain explicitly labelled as synthetic.

### Work completed during the Codex continuations

| Area | Implemented behavior |
|---|---|
| Social feed and creation | Hot takes with optional music, two-pick polls with vote/change/undo, Community/Following views, edit/delete/share flows, account-scoped drafts and sign-in return navigation. Poll results respect visibility and voting rules. |
| Music identity and discovery | Profile statuses, artist chips, cover walls, taste-match cards and taste twins. For You now ranks visible posts using the viewer's favourite artists, loved ratings, manual diary, follows and recency. Feed and people discovery use signed cursor pagination. |
| Branding | Renamed display/legal copy to Riffs; created an original vector mark and wordmark; regenerated app, Android adaptive, splash and favicon assets. Kept legacy package identifiers, URL scheme and storage keys for compatibility. |
| Onboarding and profiles | Optional artist/rating/follow setup, favourite artists, cropped profile photo picking/saving and paginated follower/following lists. |
| Private library | Listen Later for music and saved posts, with account privacy and current post visibility/block checks. |
| Discussion and clubs | Comment replies, linked @mentions and corresponding activity; public weekly album clubs with membership, owner picks, ratings, discussion and archives. |
| Messaging | Direct chats and groups of up to 12 members; text/music/post sharing, paged message history, unread counts, persistent read positions, retry-safe sends, removal, reporting, message opt-outs, member removal and leave/ownership transfer. Access checks enforce membership and blocks. |
| Messaging usability | Chats open at the latest message, reveal sent messages, follow incoming messages near the bottom, preserve older reading when history is prepended, and show Jump to latest for new messages. Recipient selection and inbox unread counts have accessible roles/states/labels. |
| Email ownership and sign-in | Resend-backed email OTP, purpose-bound signup codes and existing-account email verification. Includes expiry, keyed code digests, attempt/resend limits and one-use consumption. Production signup rejects missing delivery configuration; development allows unverified signup while setup is deferred. OTP is an alternative to password sign-in, not MFA. |
| Push support | Opt-in native Expo registration/navigation, session-bound device tokens, durable delivery jobs, access/preference rechecks, retries, receipts and invalid-device cleanup. Account changes cancel pending client registration/preference writes. Actual device delivery is unverified. |
| Listening diary | Private manual music logs with pagination and clearing. It does not track Spotify/Apple playback automatically. |
| Playlist import | Create → Bring a playlist: public Deezer tracks, source links for Spotify/Apple Music, and pasted track lists/export CSV matched through keyless catalog search. Review ambiguous matches before publishing a pod; source links survive editing. Maximum 100 tracks per import. |
| Populated demo | Repeatable seed with 12 labelled bots, a demo listener, three album clubs and an initial 178 posts. Local bot replies/reactions/votes target only the demo listener's new public posts. Seeding preserves existing data; cleanup removes demo identities/content. |
| Reliability and privacy | Additive schema migrations, account-scoped remote state and drafts, visibility/block checks across new flows, post-attachment access rechecks, and removal of nested pod-detail buttons found during browser QA. |

The inherited ratings/comparison game, pods, rankings, mood boards, item pages, share cards, catalog integrations and native video-overlay source remain in the app. Codex extended and tested these paths where relevant; native video is not claimed complete or verified.

### Playlist and provider limits

Pasting a public Deezer playlist can import its tracks when the provider is available. Spotify/Apple Music URLs alone attach the original source; they do not supply track lists in the current implementation. Spotify's anonymous oEmbed path can supply a title, not tracks. Users can paste track rows or an export CSV and review catalog matches, or choose picks manually. Do not promise universal one-link import, private playlist access, automatic listening history or audio playback.

### Main implementation locations

| Files | Responsibility |
|---|---|
| `server/api.mjs`, `server/schema.sql`, `server/db.mjs` | API integration, authorization, schema and additive migrations |
| `server/community.mjs` | Onboarding/profile helpers, connections, private library, replies/mentions and clubs |
| `server/expansion.mjs` | Conversations/messages/reports, cursor feed/people, diary, preferences, verification and push-token routes |
| `server/email-otp.mjs` | Purpose-bound email challenges and Resend delivery |
| `server/push.mjs` | Durable Expo push queue and delivery/receipt handling |
| `server/playlist.mjs`, `src/lib/playlist.ts` | Provider-link validation/adapters and pasted track/CSV parsing |
| `server/demo-seed.mjs`, `server/demo-bots.mjs`, `server/demo-server.mjs` | Local demo data and synthetic activity |
| `src/app/messages/`, `history.tsx`, `import-playlist.tsx`, `account-preferences.tsx` | New social-expansion screens |
| `src/app/onboarding.tsx`, `connections/`, `clubs/`, `library.tsx` | Community screens |
| `src/store/AppContext.tsx`, `src/ui/pages.ts`, `remote.ts` | Account state, drafts and remote/paged loading |
| `src/lib/push.native.ts`, `push.ts`, `api.ts` | Native push, explicit web fallback and session-change guard |
| `src/ui/components.tsx`, `primitives.tsx`, `theme.ts` | Shared layout, composer scrolling, controls and retained dark design system |
| `assets/brand/`, `scripts/generate-icons.cjs` | Original Riffs branding and generated app assets |
| `server/test/`, `scripts/test-core.cjs`, `test-push-session.cjs` | API integration, parser/scoring and push-session checks |

### Verification completed

- `npm run typecheck` and `npm run lint` pass.
- `npm test` passes all **43 API test cases**, plus core comparison/rating, playlist parsing and push-session checks.
- The latest web export passed: `%TEMP%/riffs-expansion-export-ready`. This is a temporary build artifact, not a deployment.
- Bundled Playwright Chromium exercised phone (390×844) and desktop (1440×960) web flows. New flows used isolated memory data, synthetic email delivery and deterministic catalog/provider adapters. Earlier OTP and demo checks are also recorded.
- Tested two-account chat/replies/unreads, music/post attachments, reporting/removal, groups/leave, private diary, playlist matching/source retention, preferences, feed paging and verified signup. Eight targeted messaging assertions checked viewport positioning, earlier-message anchoring, Jump behavior and accessibility. Recorded final targeted checks have zero page or console errors.
- The finish reviewer returned **ship** and scored both named messaging fixes resolved, within the evidenced web scope. A separate documentation comparison confirmed retained visual tokens and preserved the incumbent design files. It recorded stale For You prose and pre-existing sidecar sample/narrative drift.

Evidence: `.impeccable/review/riffs/` for the earlier community/branding batch; `.impeccable/review/expansion/` for current screenshots, `qa-results.json`, `messaging-fix-results.json`, `finish-verdict.md` and `documentation-check.md`. Browser fixtures/runners were temporary QA tools; do not treat synthetic delivery as real provider verification. The temporary fixture server was stopped after testing.

### Run locally

Workspace: `C:\Users\Acer\Desktop\ranked-app`. Stack: Expo SDK 57, React Native 0.86, React 19, TypeScript and Node 24 API; local SQLite with optional Turso.

From the workspace, run in separate terminals:

```powershell
npm run api:demo
```

```powershell
npm run web -- --port 8081
```

Use `npm run api` instead of `api:demo` to run without the live demo bot worker; it does not remove seeded content. App: `http://localhost:8081`; API: `http://localhost:8787`.

Optional demo login: `listener@demo.margin.invalid` / `MarginDemo2026!`. These are deliberately public demo credentials, not an owner account. `npm run demo:seed` adds demo content without live replies. `npm run demo:clear` removes demo identities and their content; interactions attached to their deleted posts cascade too.

### Required before a production release

1. **Email:** set server-only `RESEND_API_KEY` and verified `EMAIL_FROM` in `server/.env`, restart the API, and verify real signup/sign-in/reset email delivery. Keep credentials out of client code and Git.
2. **Hosting:** choose HTTPS API/web hosting, configure release API/web URLs, allowed origins, production encryption/provider secrets, persistent storage/backups and store/legal/support details.
3. **Native build and device QA:** rebuild for the new branding, native modules and notifications; test photo/camera/microphone permissions, keyboard/navigation, share/Photos flows and background behavior on physical phones.
4. **Push:** configure the EAS project plus FCM/APNs credentials, enable `PUSH_ENABLED=1`, optionally configure server-only `EXPO_ACCESS_TOKEN`, then verify opt-in and device delivery. Queue tests do not prove actual notifications arrive.
5. **Video:** compile the inherited Android/iOS overlay module and test recording/export/orientation on devices. It has not been compiled or verified here.
6. **Scaling:** run one API worker per SQLite database. Coordinate push queue claims before multiple workers share a database. Plan photo object storage and broader club/library/profile pagination; monitor feed query cost with real traffic.
7. **Real launch data:** remove synthetic demo content when moving to a real community, then test the share → discuss → return loop with the owner, Mandi and a small group.

Audio and automatic external listening history remain intentionally outside the current scope. Live playlist-provider availability, native behavior and real email/push delivery still require verification. The local web app is usable and tested; a production mobile release is not yet verified end to end. `READINESS.md` has the release matrix; `README.md` has setup details.

### Repository and continuation rules

The current branch is `main`. The workspace includes extensive uncommitted and untracked work from Claude and Codex. No commit, push, deployment or store submission was performed. Review and preserve the whole working tree; do not reset it or assume all changes came from the last batch. Local data and encryption material live under ignored `server/data/`; back them up before changing storage or deployments.

Continue from this current handoff and READINESS.md. Do not re-enable audio, add a Spotify dependency, recreate personal profiles, reset real data, or describe native/provider-dependent features as verified without new evidence. The recommended next milestone is a small real-user beta after email/hosting/device setup, rather than adding another broad feature batch.

## Historical continuation notes

## Social expansion — 8 October 2026

The owner approved the remaining feature batch, excluded audio playback, said Spotify API will not be used, and proposed pasted playlist links. New features therefore use Riffs data and keyless catalogs; existing optional Spotify code is retained behind configuration.

Implemented `server/expansion.mjs`: member-only direct/group messages (12 members maximum), music/post attachments, idempotent sends, unread/read positions, message paging/removal/reports, opt-outs, group removal/leave with ownership transfer, cursor-paginated discovery and feed, account preferences, and a private manual listening diary. `server/push.mjs` provides session-bound native tokens, an opt-in durable push queue, generic payloads, access rechecks, retries/receipts and invalid-device cleanup. Native token registration and notification navigation use expo-notifications; delivery remains disabled until PUSH_ENABLED and native credentials are configured.

For You ranks visible posts using favourite artists, loved ratings, diary artists, follows and recency; cursors preserve the ranking inputs for each page session and are bound to the viewer/query. It is a transparent rules-based feed, not machine learning. The diary logs user choices and never pretends to track external playback.

Signup uses purpose-bound email codes when Resend is configured and activates the account only after successful proof. Production signup refuses missing delivery configuration. Development retains unverified account creation while Resend is deferred. Existing users can verify in Settings; sign-in OTP also verifies ownership. Old email_otps and user columns migrate additively.

`server/playlist.mjs` and Create → Bring a playlist import public Deezer tracks (up to 100), preserve Spotify/Apple Music source links, and match pasted track lists/export CSV using keyless catalog search. Exact matches are selected; ambiguous matches require review. No Spotify track extraction is claimed from oEmbed. Imported pods retain their source link, including after edit. Pod detail controls were separated into siblings to remove invalid nested buttons exposed by this flow.

TypeScript, lint, core math/playlist parsing checks, push-registration account-switch checks and 43 API tests pass. Browser evidence uses isolated memory data, two accounts, synthetic email/catalog adapters, and phone/desktop sizes; live inbox delivery and native permissions/push/video remain unverified. The final web export is `%TEMP%/riffs-expansion-export-ready`. The finish reviewer disposition is ship: both named messaging fixes were scored resolved. Chats open/follow at the latest message, reveal sent messages, preserve older-page reading, and expose Jump to latest; recipient choices and inbox unread counts have accessible states. Eight targeted browser assertions passed without page/console errors. Evidence and verdict are in `.impeccable/review/expansion/`. Existing real accounts/posts are preserved. No commit, push, deployment or store submission has occurred. Earlier continuation statements below are historical.

## Codex continuation — 8 October 2026

The later social expansion above supersedes this section's future-work list. Its final documentation comparison is complete in `.impeccable/review/expansion/documentation-check.md`; the incumbent design files were preserved, with stale feature wording and pre-existing sidecar drift reported.

The owner renamed the app **Riffs**. Display branding and legal copy now use that name. `assets/brand/` contains an original vector r mark and wordmark; `scripts/generate-icons.cjs` regenerates app/adaptive/splash/favicon assets and embeds raster provenance. Legacy bundle identifiers, URL scheme, storage keys, and demo credentials are deliberately preserved for compatibility. Rebuild native apps for the new installed name and icons.

The approved feature batch is implemented: optional three-step onboarding, favourite artists, cropped profile photos, paginated follow lists, private Listen Later and saved posts, comment replies and linked @mentions with activity, and public weekly album clubs with membership and archives. New additive database migrations preserve existing accounts and posts. `server/community.mjs` holds the community routes; five new integration tests cover persistence, visibility/blocks, reply/mention deduplication, club ownership, concurrent weekly picks, and cascaded cleanup. Demo seeding adds three labelled clubs and their initial weekly discussions, bringing the initial seed to 178 posts.

TypeScript, lint, core checks, all 35 API test cases, and web export pass. Bundled Playwright tested the new flows on phone/desktop web sizes with an isolated memory API and catalog adapters, including actual file picking/cropping, reply/mention notifications, and followers. The finish reviewer approved the evidenced web scope after shared compact buttons and segmented tabs were enlarged to 48-point targets. DESIGN.md and its sidecar document the retained design system. Evidence lives in `.impeccable/review/riffs/`.

Resend remains deferred at the owner's request. Real inbox delivery, native photo permissions, native video compilation/export, deployment, and store/device QA remain pending. Messaging, push, automatic listening history, and personalized recommendations are future work outside this batch. See READINESS.md. No commit, push, deployment, or store submission occurred. The sections below are historical and their MARGIN naming/test counts do not supersede this continuation.

## Codex continuation — 6 October 2026

Latest continuation: local demo tooling now seeds 12 labelled bots and a test listener while preserving existing users. `npm run api:demo` also starts idempotent replies/reactions/poll votes for the demo listener’s new public posts only. `npm run demo:clear` removes only demo identities/content. The catalog snapshot contains real music metadata from Apple’s India storefront. Owners create their own profiles; no Ayush/Mandi identities were seeded.

Email OTP sign-in is implemented for existing registered accounts (`/api/auth/otp/request`, `/api/auth/otp/verify`, capability `/api/config.emailOtp`). It uses Resend, keyed digests, ten-minute expiry, one-use concurrent consumption, five-attempt lockout, persistent email cooldown/hourly limits, and IP limits. Configure `RESEND_API_KEY` plus verified `EMAIL_FROM` to enable real delivery; no credentials are present locally. Registration remains name/username/email/password and does not verify email; OTP is an alternative sign-in method, not MFA. Browser OTP delivery used an isolated adapter, not a real inbox.

Current checks: TypeScript, lint, core math checks, all 30 API test cases (including nested cases), and web export pass. Populated browser checks cover profile/feed/Following/twins/activity, seeded review routes, poll vote/change/undo, OTP wrong/correct codes and session reload, plus live bot replies and reactions. See `READINESS.md` for release gaps and README for local demo/email setup. The historical 23-test statements below describe the earlier continuation.

The social client work listed in the original handoff below has been implemented: take/poll types, iTunes preview metadata, a gated preview provider and floating player, dark app configuration with background audio disabled, shared social components, community/Following feeds, take and poll composer, edit/delete/share flows, profile statuses, artist chips, cover walls, taste-match cards, and taste twins in Discover. `src/app/take.tsx` is the new composer; drafts are saved per account in `AppContext` alongside existing drafts.

Playback is off unless `EXPO_PUBLIC_ENABLE_PREVIEWS=1`. The default music attachment opens its source service. Apple’s promotional-content requirements need review before enabling audio in a social feed. Spotify previews are deprecated and nullable. Native video export remains uncompiled and needs a new device build; no deployment, store submission, commit, or push has occurred.

The navigator now stays mounted while account-scoped drafts load, so signing in from a composer preserves the return path. An opaque overlay covers account changes until the next scope is ready. Poll mutations update the shared store without moving old posts to the top of the feed. Takes and polls use their own detail and share layouts rather than ranking actions.

The historical “Left to do” list below predates this continuation. README now describes the social features, playback policy, and dark theme; DESIGN is refreshed from the implemented tokens.

Verification: TypeScript and ESLint pass, all 23 API tests pass, and the web bundle exports successfully. Bundled Playwright Chromium checked phone/desktop layouts and the complete draft/sign-in/publish/edit/comment/like/poll/status/match/twins/share flows against an isolated temporary database. Additional checks verified existing account drafts survive guest sign-in, archived takes reopen from Profile, a 280-character two-pick poll fits a narrow share frame, actual 1080×1350 PNG downloads, and missing share posts show retry states. A finish reviewer confirmed the named fixes. Web warnings are dependency deprecations (`pointerEvents`, `shadow*`), not app runtime errors. Tests do not verify native video, audio, Photos saving, or provider account credentials.

Recovered take/mood drafts appear under Profile → Drafts. Account changes revalidate post/share data and key person/item snapshots to the viewer, preventing stale private content from carrying between sessions. The original handoff’s Spotify 25-user development-mode limit is obsolete; README links the current five-authenticated-user rules and shared developer quota.

---

Status as of 6 October 2026. The repo is a clone of `github.com/gaurangp22/spotlight` with uncommitted work on top. Nothing is committed or pushed yet.

**Goal:** a music-first social app. It started as Podiums-style rate & rank and is now moving toward an Equals-style social feed. The name stays **MARGIN**; ignore any earlier "Tiffin Talks" mention, which was a mistake.

**Current health:** `npx tsc --noEmit` is clean, ESLint is clean, and `npm test` passes 23 of 23 (16 earlier API tests plus 7 for the new social features).

> Two AI sessions worked in this folder in parallel. One built the screens in `src/`; the other built the server, native module, share cards, video screen, theme and docs. Review the whole diff (`git status`, `git diff`) before committing.

---

## 1. Done and verified

| Area | What | Where |
|---|---|---|
| Ratings | Gut-reaction tier, a head-to-head insertion game, and a personal 0–10 score that rebalances as you rate more | `server/api.mjs` (`/api/ratings`), `src/app/rate.tsx` |
| Item pages | Your, friends' and everyone's average score, plus the reviews you're allowed to see | `/api/items/:id`, `src/app/item/[id].tsx` |
| Pods | Collections with optional open contributions, credited to whoever added each pick | `/api/posts/:id/items`, `src/app/pod.tsx` |
| Catalog | Songs and albums from iTunes (client side); artists from Deezer, shows from TVmaze and books from Open Library through the server; movies from TMDB (needs a key). **The UI is music-first**: only song, album and artist are shown, set by `activeKinds` in `src/lib/categories.ts` | `server/catalog.mjs`, `src/lib/music.ts` |
| Spotify | Server-wide search and **paste-a-link import** using app credentials: no user login and no 25-user cap. Optional account connect for top tracks and playlists | `server/spotify.mjs` (`fromLink`, `top`), `src/ui/SpotifyLinkImport.tsx` |
| Share cards | Night, Paper and Red templates in Post 4:5 and Story 9:16, exported at 1080×1350 or 1080×1920, for rankings, reviews, pods and Top 5 | `src/ui/ShareCards.tsx`, `src/app/share/[id].tsx`, `src/app/share/top.tsx` |
| Video reviews | Record yourself with the cover, score and caption burned in, then save or share (to Instagram, adding music there) | `src/app/video.tsx`, `modules/video-overlay/` |
| **New social API** (tested) | Hot takes (`kind: 'take'`, up to 280 characters, 0–1 attached item), **polls** (2 items; tally hidden until you vote; options lock once voted on), **taste match** (0–100% with shared artists), **taste twins**, **profile status**, **Apple preview URLs** | `server/api.mjs`, `server/test/social.test.mjs` |
| DB migration | Old databases are upgraded automatically on start and keep comments, reactions and pod settings. Covered by tests | `server/db.mjs` |
| Dark Equals-style theme | Dark only: true black, `#1C1C1E` cards, coral `#FF6B4A` accent with **black** text on coral fills (white would fail AA contrast), Archivo Black headlines, Space Mono uppercase labels on pill buttons. Every text pairing passes WCAG AA | `src/ui/theme.ts`, `src/ui/primitives.tsx` |
| Song previews | Shared audio player, `usePreview()` hook and `MiniPlayer` pill; previews pause when the app goes to the background. **Written but not mounted yet** (see §2) | `src/ui/preview.tsx` |

### New API endpoints

```
POST /api/posts            { kind:'take', title, items:[]|[item], visibility }          → hot take
POST /api/posts            { kind:'take', poll:true, title, items:[a,b], visibility }   → poll
PUT|DELETE /api/posts/:id/vote   { choice: 0|1 }      → post.poll = { total, mine, counts|null }
GET  /api/people/:handle/match   (auth)               → { percent|null, shared[], sharedArtists[{name,artwork?}] }
GET  /api/twins                  (auth)               → { twins:[{ user, percent, sharedArtists }], needed }
PATCH /api/me              { name, bio, status? }     → status is max 60 chars, returned on every profile
items[].previewUrl         https only, *.apple.com / *.mzstatic.com
GET  /api/catalog/spotify-link?url=…                  → { title, items }
```

---

## 2. Left to do (in priority order)

1. **Client types.** In `src/lib/types.ts`:
   - Add `previewUrl?: string` to `MusicItem`.
   - Add `'take'` to `Ranking.kind`, and `poll?: { total: number; mine: 0 | 1 | null; counts: [number, number] | null }` to `Ranking`.
   - Add `status?: string` to `Profile`.

   Then map iTunes `previewUrl` in `src/lib/music.ts` and remove the local `Playable` type in `src/ui/preview.tsx`.
2. **Mount the preview player.** Wrap the app in `<PreviewProvider>` (`src/app/_layout.tsx`, inside `AppProvider`). Render `<MiniPlayer bottom={tabBarHeight + 8} />` over the tabs in `src/app/(tabs)/_layout.tsx`. Give the tab bar a fixed height of 56 plus the bottom inset, and make it icons-only (`tabBarShowLabel: false`, black background). Add `MINI_PLAYER_HEIGHT` of bottom padding in `Screen` (`src/ui/components.tsx`) while `usePreview().item` is set.
3. **`app.json`:**
   - Set `"userInterfaceStyle": "dark"`.
   - Configure the auto-added `expo-audio` plugin as `["expo-audio", { "microphonePermission": "MARGIN uses the microphone only if you turn on sound for a video review.", "enableBackgroundPlayback": false }]`. The default enables background playback, which adds a foreground-service permission that Google Play makes you declare.
4. **Equals components**, planned for a new `src/ui/equals.tsx`:
   - `UnderlineTabs` (For You / Following)
   - `StoryRail` (friends' photo cards with their latest cover)
   - `TrackPill` (cover, title and a play button using `usePreview().toggle`)
   - `PostActions` (heart, comment, send)
   - `PollCard` (two bars with percentages, using `PUT /vote`)
   - `MatchCard` ("67% similar" plus `ArtistChip`s, coloured with `chipColor()` from `theme.ts`)
   - `StatusBubble`
   - `CoverWall` (3-column grid)
5. **Screen redesigns** using those components:
   - Home feed: For You / Following, the friends rail, take rows.
   - A take/poll composer.
   - Profile and person pages: hero, status, match card, cover wall, top-artist chips.
   - Discover: a "Your taste twins" row from `/api/twins`.
   - Status editing in Settings.
   - `AppNotification` kinds already cover existing types. **Don't add a new notification kind without updating `src/app/notifications.tsx`**, because an unknown kind crashes that screen.
6. **Visual QA in the browser.** The share cards and the new theme have not been seen rendered yet. Run `npm run api` and `npx expo start --web`; if Expo hangs on start, add `--non-interactive` or `CI=1`.
7. **Docs.** `README.md` describes the Podiums-era 2.0 features but not the social/Equals work or the dark theme. `DESIGN.md` still describes the old light "warm neutrals" palette.

---

## 3. Not verifiable here — needs a real device build

- **`modules/video-overlay` has never been compiled.** There was no Android SDK or Xcode on this machine. Android uses Media3 Transformer 1.9.0 (pinned to match `expo-video`); iOS uses AVFoundation. The first EAS build is the test. Assumptions to check are listed at the top of each native file, mainly whether the overlay comes out in the right orientation on Android.
- **Saving to Photos** uses the new `expo-media-library` API (`Asset.create`) via `src/lib/saveVideo.ts`. The old `saveToLibraryAsync` **throws** in SDK 57, so don't reintroduce it.
- **Song previews** (expo-audio) haven't been heard on a device.
- 2.0 adds native code, so phones need a **new build**. An over-the-air update can't deliver it. `runtimeVersion` follows the app version, which is now 2.0.0.

```bash
npx eas-cli@latest build --platform android --profile development   # test build with the native module
npx eas-cli@latest build --platform android --profile production    # store build
```

---

## 4. Owner setup before publishing

| What | Where | Effect |
|---|---|---|
| `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` | server env | Spotify search and link import for everyone |
| `SPOTIFY_REDIRECT_URI` + User Management in the Spotify dashboard | server env, developer.spotify.com | Optional account connect (25 users max while Spotify keeps the app in development mode) |
| `TMDB_API_KEY` | server env | Movies (hidden in the music-first UI anyway) |
| `TOKEN_ENCRYPTION_KEY`, `NODE_ENV=production`, `EXPO_PUBLIC_API_URL` | server env / EAS env | Required for production |
| Store listing | Play Console / App Store | New screenshots (`docs/screenshots` are outdated), the Data safety form (camera and microphone are used on-device only), and **legal review of `server/legal.json`** |

Bundle ID `com.marginmusic.app`, the slug, the `marginmusic://` scheme and the EAS project ID are unchanged on purpose.

---

## 5. Useful commands

```bash
npm ci && npm --prefix server ci
npm run api              # API on :8787 (local SQLite in server/data/)
npx expo start --web     # web app on :8081
npx tsc --noEmit && npm run lint && npm test
node scripts/generate-icons.cjs   # regenerate the "M." icon set
```
