<div align="center">

<img src="assets/icon.png" width="96" height="96" alt="Riffs app icon" />

# Riffs 2.0

**Music, in your own order.**

Music opinions, with somewhere to go. Post a hot take, let friends settle a two-pick poll, rate songs and albums, and find people who hear music the way you do. The app shows songs, albums, and artists; the server retains the other catalog integrations.

![Expo SDK 57](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)
![React Native 0.86](https://img.shields.io/badge/React_Native-0.86-087EA4?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node 24](https://img.shields.io/badge/Node-24-5FA04E?logo=nodedotjs&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-Android_·_iOS_·_Web-C63A22)

### [⬇ Download the Android APK](https://github.com/gaurangp22/spotlight/releases/latest)

</div>

---

## Why Riffs

Most apps tell you what to watch and listen to. Riffs is about what you *think* — and about the argument that follows. The core loop:

1. **Rate** anything with a gut reaction, then settle it head-to-head against things you’ve already rated. Out comes a personal 0–10 score.
2. **Show off** your top five in every category, right on your profile.
3. **Collect** favourites into pods — and open them up so friends can add theirs.
4. **Post** a video review: you on camera, the cover art, your score, and your caption, ready for Instagram.

## Features

| | |
|---|---|
| **Rate & review** | Songs, albums, artists, movies, TV shows, podcasts, and books. Pick a tier (*Loved it*, *It was fine*, *Not for me*), then play a quick comparison game against your past ratings in that category. The game places the item exactly, and the app derives a personalized 0–10 score that re-balances as you rate more. Add a written review if you like. |
| **Item pages** | Every title has a page with its community average, your friends’ average, your own score, and the reviews you’re allowed to see. |
| **Top 5** | Each profile shows a podium per category, drawn live from that person’s ratings and shareable as a designed card. |
| **Pods** | Collections for any theme, mixing categories freely. Open a pod and anyone who can see it can contribute, with their name shown on each pick. |
| **Video reviews** | Record yourself with the cover art, score, and caption burned into the video on the device. Save it, or share it straight to Instagram and add music there with *Add audio*. Sound is off by default. |
| **Rankings & Battle Mode** | Up to 100 picks in your exact order, by hand or decided head-to-head. Remix a friend’s ranking with “Make mine” and compare the two with an agreement score. |
| **Mood boards** | Picks, photos, and notes on one of four colour stories. |
| **Bring a playlist** | Import a public Deezer playlist, preserve a Spotify/Apple Music playlist source, or paste a track list/export CSV. Review catalog matches before publishing a pod. Spotify metadata links do not supply track lists. The current app does not require Spotify API credentials. |
| **Social** | Follow people, agree with posts, comment on a post or on a single pick, and get an activity feed with unread badges. |
| **Hot takes & polls** | A 280-character take with an optional music attachment, or a question between two picks. Results stay hidden until voting (the author can see them). Change or undo your vote; picks lock once votes exist. Drafts save on the device, per account, and survive sign-in. |
| **Community & Following feeds** | For You prioritizes artists from your Riffs favourites, loved ratings, diary, and follows, with a recency boost. Following shows your posts and your circle. Signed cursor pages keep loading older posts; discovery also pages people/posts. Private posts remain on profiles. |
| **Taste twins** | Discover suggests people with similar scores after you rate at least three items. Person pages show your match and shared artists, calculated only from ratings you may view. |
| **Music identity** | A 60-character music status, artist chips derived from ratings, a cover wall, and shareable top fives. |
| **Getting started** | Optional three-step setup: choose favourite artists, rate starter picks, and follow people. Reopen setup from Settings. |
| **Profiles & connections** | Choose a cropped profile photo, show favourite artists alongside rating-derived favourites, and open paginated followers/following lists. |
| **Private library** | Save songs, albums, and artists to Listen Later, or bookmark posts. Saved posts still obey their author's visibility and blocking rules. |
| **Replies & mentions** | Reply to a specific comment, tap @usernames to open profiles, and receive reply/mention activity without exposing inaccessible posts. |
| **Listening clubs** | Join public album clubs. Owners select one album per UTC week; members rate and discuss it, with previous weeks available in the club archive. |
| **Messages** | Direct messages and groups of up to 12 members, text/music/post attachments, inbox unread counts, persistent read positions, earlier-message pages, retry-safe sends, removal, reports, and blocking. Chats open at the latest message, follow new messages near the bottom, and preserve older reading with a Jump to latest action. Recipient choices and unread counts expose screen-reader states. Group owners can remove members; leaving transfers ownership. Active threads poll every five seconds. |
| **Listening diary** | Privately log songs, albums, or artists and clear your diary. These are manual entries, not automatic tracking or inferred plays. |
| **Account preferences** | Control new messages/group invitations and push alerts, or verify an existing account email. Signup requires an email code when delivery is configured. |
| **Privacy controls** | Public, followers-only, or private posts and ratings, enforced on the server. Community averages only count ratings the viewer may see. Block and report built in. |
| **Share cards** | Takes, polls, rankings, reviews, pods, and top fives as Night, Paper, and Red templates in 4:5 and 9:16, exported through the native share sheet (or downloaded on web). Poll share cards invite voting without exposing a hidden tally. |

### Where the catalog comes from

Audio playback is **disabled by default**. Music attachments link out to the original service. iTunes can return `previewUrl`, but Apple limits these assets to promoting store content, requires attribution and a nearby approved store badge, and prohibits downloading, caching, and synchronizing previews with video. Review [Apple’s promotional-content terms](https://performance-partners.apple.com/resources/documentation/itunes-store-web-service-search-api/) before enabling `EXPO_PUBLIC_ENABLE_PREVIEWS=1`; the included player is an opt-in implementation, not a declaration that the social-feed use meets those terms. Spotify’s `preview_url` is [deprecated and nullable](https://developer.spotify.com/documentation/web-api/reference/get-track), so playback does not rely on it. Do not burn provider previews into video reviews.

Riffs uses a dark-only canvas, coral actions with black labels, Archivo Black headlines, Inter body text, and Space Mono control labels. See [DESIGN.md](DESIGN.md) for the current tokens and components.

You don’t need your own media database. Searches go to free public catalogs, and Riffs keeps only a copy of the items people actually rate, rank, or collect.

| Category | Source | Setup |
|---|---|---|
| Songs, albums, podcasts | Apple iTunes Search API, called from the device | None |
| Artists | Deezer, through the API server | None |
| TV shows | TVmaze, through the API server | None |
| Books | Open Library, through the API server | None |
| Movies | TMDB, through the API server | `TMDB_API_KEY` (free). Hidden until set |
| Songs, albums, artists (optional) | Spotify, through the API server | `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` |

With a Spotify client secret configured, music search switches to Spotify for everyone, using the server’s own app token. Catalog search uses the server’s credentials. Optional personal account connections have separate provider access and quota requirements; see the Spotify setup section below.

## Design

Riffs is designed to feel at home next to first-party apps: large collapsing titles, inset grouped lists, spring-based press feedback, haptics on every meaningful action, and an established dark theme with coral actions.

- **Type:** Inter, on a single type scale modelled on platform text styles (`src/ui/theme.ts`).
- **Colour:** black and charcoal surfaces with coral actions and readable white text.
- **Components:** one set of primitives (`src/ui/primitives.tsx`) — buttons, segmented controls, sheets, dialogs, list groups — so every screen behaves the same way.
- **Accessibility:** labelled controls, 48 pt button and segmented-tab targets, Dynamic Type support with sensible caps, and screen-reader announcements for notices.

See [DESIGN.md](DESIGN.md) for tokens and principles.

The Riffs mark and wordmark are original vector paths in `assets/brand/`. Run `node scripts/generate-icons.cjs` to regenerate the icon, favicon, splash assets, adaptive Android icons, and raster wordmark. Existing package identifiers, deep-link scheme, local storage keys, and demo credentials retain their legacy names so existing installations and data remain compatible. A new native build is required to update installed names and icons.

## Architecture

```
┌──────────────────────────┐        HTTPS / JSON        ┌───────────────────────────┐
│  Expo app (src/)         │ ─────────────────────────▶ │  Node 24 API (server/)    │
│  Expo Router screens     │                            │  node:http, no framework  │
│  AppContext state        │ ◀───────────────────────── │  SQLite  ⇄  Turso libSQL  │
│  Drafts in AsyncStorage  │                            │  Spotify · Resend         │
│  Session in SecureStore  │                            │  Catalog proxy + cache    │
│  Video overlay (native)  │                            │  /privacy /terms pages    │
└──────────────────────────┘                            └───────────────────────────┘
```

| Layer | Stack |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19, Expo Router (typed routes), Reanimated 4, expo-image, expo-camera, expo-video, expo-haptics |
| Video | `modules/video-overlay`: a local Expo module that burns the review card onto the recording — Media3 Transformer on Android, AVFoundation on iOS |
| API | Node 24 `node:http`, `node:sqlite` locally, `@libsql/client` for Turso, scrypt password hashing, AES-256-GCM token encryption |
| Tooling | TypeScript (strict), ESLint (`eslint-config-expo` + React Compiler rules), `node:test`, EAS Build |

### How scores work

Each rating has a tier (2 = loved it, 1 = it was fine, 0 = not for me) and a position inside that tier, set by the comparison game. Tiers map onto score bands — 6.8–10, 3.4–6.7, and 0–3.3 — and positions spread evenly down each band, with #1 in a tier always at the top of its band. Rating, re-rating, or deleting anything rescores that tier on the server in one transaction.

## Getting started

**Requirements:** Node 24+, npm, and for native builds Android Studio (SDK 36, JDK 21) or an [Expo account](https://expo.dev) for cloud builds.

```bash
npm ci
npm --prefix server ci
npm run api            # API on http://localhost:8787 — keep this running
```

In a second terminal:

```bash
npm start              # Expo dev server (Android dev build / emulator)
npm run web            # or run in the browser at http://localhost:8081
```

Visitors see clearly labelled example rankings; signed-in feeds show real posts. To test social features, create two accounts in separate browser profiles. Video reviews need the phone app; on the web the option explains that.

The local database and the auto-generated token encryption key live in `server/data/` (git-ignored). Back up both. Databases from version 1 are migrated automatically on first start, keeping every post, comment, and reaction.

### Testing on your phone without reinstalling

You don't need a new APK for every change. Pick the loop that fits:

| Loop | When | How |
|---|---|---|
| **Dev build + live reload** (recommended) | Day-to-day work. Every save appears on your phone in a second or two. | Install a development build **once**: `npm run build:dev`, then open the link EAS prints on your phone. After that, run `npm run api` and `npm run phone` on your laptop, keep the phone on the same Wi-Fi, and open the Riffs dev app — it finds your laptop automatically (or scan the QR code). Reinstall only when native libraries change. |
| **Phone browser, no install** | Quick look at a screen or a friend's opinion on a layout. | Run `npm run api` and `npm run phone:web`, then open `http://YOUR-LAPTOP-IP:8081` in your phone's browser. In development the API accepts phones on your home network. Camera, push, and video reviews need the real app. |
| **Over-the-air updates** | Sending changes to testers (e.g. Mandi) who already have the preview app. | `npm run update:preview`. Their app downloads the new version on its next launch — no reinstall. Works for JavaScript and design changes; native changes still need `npm run build:preview`. |

Version 2.0 added native libraries (camera, video, blur, notifications), so make **one** new development or preview build first; after that the loops above are enough.

### Running on an Android phone

Keep the phone and computer on the same Wi-Fi. Development discovers the Metro host automatically; if it can’t, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8787`, and restart Metro. Allow inbound connections on ports 8787 and 8081.

Riffs uses native modules (camera, video overlay, haptics, secure storage, image picking), so use a development build rather than Expo Go: `npm run android` with Android Studio installed, or `npx eas-cli@latest build --profile development`. Version 2.0 adds native code, so phones on 1.x need a new build — an over-the-air update can’t deliver it.

<details>
<summary><b>Building a local test APK on Windows</b></summary>

```powershell
$env:MARGIN_LOCAL_PREVIEW='1'
$env:EXPO_PUBLIC_API_URL='http://YOUR_LAN_IP:8787'
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA/Android/Sdk"
npx expo prebuild --platform android --clean --no-install
Set-Location android
./gradlew.bat assembleRelease --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. This APK allows plain HTTP, embeds your computer’s address, and is signed with a test key — it is for local testing only.

If an older Windows SDK hits Ninja’s path-length limit, install [Ninja 1.12+](https://github.com/ninja-build/ninja/releases) and set `MARGIN_NINJA_PATH` to its executable before prebuild.

</details>

## House bots

Small communities feel empty, so Riffs can run six labelled house bots — Riffs Radio, Desi Decks, Bars Only, Pop Oracle, Indie Hours, and Crate Digger — each with its own taste. Turn them on with `RIFFS_BOTS=1` in `server/.env`.

- **What they do:** post real albums and songs from Apple's public catalog as reviews, hot takes, and polls (by default up to 8 posts a day, at least 45 minutes apart); like, vote on, and sometimes reply to real people's recent **public** posts (always on someone's first few posts, never more than two replies a day per person); and Riffs Radio follows new members so their first notification isn't silence.
- **How they stay honest:** they're always labelled with a **BOT** badge, can't be signed into, act only through the public API (so visibility, blocking, and validation rules apply to them exactly as to people), never touch private or followers-only posts or messages, and are excluded from `admin.mjs stats`. The privacy policy discloses them.
- **Opt-out:** anyone can hide bots in Settings → Messages, alerts & email; bots then disappear from their feeds and stop interacting with them. Blocking a bot also works.
- **Pacing:** `BOT_DAILY_POSTS`, `BOT_POST_GAP_MINUTES`, `BOT_INTERVAL_MINUTES`.

Run one API process with bots enabled; with several workers, enable bots on only one.

## Configuration

### App (`.env`, public values only)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | **Required for release builds.** The HTTPS URL of your API. |
| `EXPO_PUBLIC_WEB_URL` | Optional. Web app URL used for shared links; otherwise links open the installed app. |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Optional. Adds “Contact support” to Settings. |

> Anything prefixed `EXPO_PUBLIC_` is bundled into the app. Never put secrets here.

### API (`server/.env`, never shipped to the app)

| Variable | Purpose |
|---|---|
| `TOKEN_ENCRYPTION_KEY` | **Required in production.** 64 hex chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | Set to `production` in deployment. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Use Turso libSQL instead of local SQLite. Schema initialises and migrates on start; existing local data is not copied to Turso. |
| `PUBLIC_API_URL`, `WEB_APP_URL`, `ALLOWED_ORIGINS` | Public API URL, web app URL (invite links, shared posts, and password reset links open it), and allowed browser origins. |
| `TMDB_API_KEY` | Enables movie search. A v3 API key or a v4 read-access token from [TMDB](https://www.themoviedb.org/settings/api). |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Server-wide Spotify search and Spotify link import for every user, no login required. |
| `SPOTIFY_REDIRECT_URI` | Only for “Connect Spotify” (top tracks, private playlists). Register the exact redirect URI (`…/api/spotify/callback`) in the Spotify dashboard. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional. Enable signup verification, email OTP sign-in, and password recovery email. Password signup and sign-in work without them. |
| `ADMIN_TOKEN` | Enables the admin CLI: stats, beta feedback, and moderation (32+ characters). |
| `ANDROID_DOWNLOAD_URL` | Optional. Adds a “Download for Android” button to invite pages (Play Store or APK link). |
| `TRUSTED_PROXY_IPS` | Reverse proxy addresses whose `X-Forwarded-For` is trusted for rate limiting. |

#### Setting up Spotify

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and tick **Web API**.
2. Add the redirect URI `https://<your-api-domain>/api/spotify/callback`.
3. Copy the **Client ID** and **Client secret** into `server/.env` (or your host’s environment variables) and restart the API.

The server implements search and link import with an app token; verify that your Spotify app actually has access to these endpoints before relying on them. **Connect Spotify** (top tracks and playlists) uses each person’s own login. Current [development-mode rules](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) limit new apps to **five authenticated users** and require the owner to have Spotify Premium; older allowed users may be grandfathered. The old 25-user statement in the original handoff is outdated. July 2026’s increase to 25 concerns **Client IDs**, and [API quota is shared per developer account](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates). Treat account connection as an extra, not the main path. Phones need an HTTPS callback reachable from their browser; web testing can use a `127.0.0.1` loopback callback (Spotify rejects `localhost`).

## Quality

```bash
npm run typecheck      # tsc --noEmit (strict, typed routes)
npm run lint           # ESLint incl. React Compiler rules
npm test               # comparison logic + API integration tests
npx expo install --check
```

The API suite covers accounts and sessions, privacy enforcement across reads/feeds/writes, blocks, reactions and comments, reports and moderation, password recovery, SQLite persistence, mocked Spotify PKCE and token refresh, ratings and score re-balancing, item pages that only average visible ratings, pod contributions, catalog proxying, the version 1 database migration, profile counts, and the public store pages.

## Releasing

Riffs ships with [EAS](https://docs.expo.dev/eas/) profiles in `eas.json` (`development`, `preview`, `production`). Production builds produce an Android App Bundle with remotely managed, auto-incrementing build numbers.

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.your-domain.com
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production   # uploads to the internal track as a draft
```

The bundle identifier (`com.marginmusic.app`), slug, and `marginmusic://` link scheme are unchanged from version 1 on purpose. Changing them would orphan existing installs and break the EAS project link.

### Store readiness

The API serves the pages store listings require — point the console at your API domain:

| Requirement | URL |
|---|---|
| Privacy policy | `https://api.your-domain.com/privacy` |
| Terms of service | `https://api.your-domain.com/terms` |
| Account deletion | `https://api.your-domain.com/delete-account` |

The same text appears in-app under **Settings → About**, sourced from one file: `server/legal.json`. **Have it reviewed** and add your legal entity name and support contact before publishing.

Already handled: in-app account deletion, no ads or third-party tracking, `ITSAppUsesNonExemptEncryption=false` for iOS, light/dark splash screens, and adaptive + monochrome Android icons.

**Permissions in 2.0.** Video reviews use the **camera**, the **microphone** (only if the person turns sound on — it’s off by default), and **save to photos** (only when they tap Save). Videos are recorded and composed on the device and never uploaded. Photos for mood boards still use the system picker. Android 13+ media-read permissions (`READ_MEDIA_*`) are blocked in `app.json`; the legacy storage permissions that `expo-media-library` declares only matter on Android 12 and older, and the app asks for write access alone when saving. Declare camera and microphone use on the store listings.

Still yours to do: create the store listings and screenshots, complete the Play **Data safety** form using the actual deployed data flows, set the content rating, run native QA on real devices (especially video reviews on Android and iOS), review catalog attribution/asset terms, verify Spotify access and quotas in your dashboard, and configure an HTTPS API plus the required production secrets.

## Deploying the API

Before deploying, run the launch checklist against the production environment. It exits non-zero while anything would break or weaken a launch (HTTP URLs, missing email delivery, a weak encryption key, demo data left in the database):

```bash
npm --prefix server run preflight
```

`server/Dockerfile`, `server/compose.yaml`, and `server/Caddyfile.example` give you a production starting point: a non-root Node 24 container with a health check, a persistent data volume, and Caddy for automatic HTTPS.

```bash
cd server
cp .env.example .env      # fill in production values
docker compose up -d --build
```

### Running the beta: stats, feedback, and moderation

With `ADMIN_TOKEN` set, from `server/`:

```bash
node --env-file=.env admin.mjs stats                   # people, daily/weekly/monthly active, retention by signup week, invites
node --env-file=.env admin.mjs feedback                # open beta feedback, newest first
node --env-file=.env admin.mjs resolve-feedback ID     # mark feedback as handled
node --env-file=.env admin.mjs reports                 # list open post reports
node --env-file=.env admin.mjs dismiss REPORT_ID       # keep the post
node --env-file=.env admin.mjs remove REPORT_ID        # delete the post
```

Stats need no analytics SDK: the server stores one row per person per day they used the app, and counts posts, ratings, comments, and messages that already exist. Demo accounts are excluded.

**Growth loop.** Every profile has a personal invite link (Profile → *Invite friends*, or Settings → *Riffs beta*). The API serves a public landing page at `/join/<handle>` so the link works for people without the app; anyone who signs up through it follows the inviter, who gets a “joined” notification. Shared post links open a public preview at `/p/<id>` with the cover image, so they unfurl in WhatsApp and iMessage. Only public posts are ever shown there.

## Project structure

```
src/
  app/            Expo Router screens — (tabs), rate, item, video, pods, ranking/[id], builder, battle, compare, share, legal, …
  store/          AppContext: session, API sync, ratings, device drafts, unread activity
  lib/            API client, catalog search, scoring and comparison maths, links, types
  ui/             Design system — theme tokens, primitives, screen scaffold, pickers, Spotify link import
modules/
  video-overlay/  Local Expo module: burns the review card onto a recorded video (Android + iOS)
server/
  api.mjs         Routes, validation, privacy rules, ratings and pods
  catalog.mjs     Deezer / TMDB / TVmaze / Open Library proxy with a short cache
  db.mjs          SQLite / Turso adapter and migrations     schema.sql   Tables and indexes
  security.mjs    Hashing, encryption, input checks
  spotify.mjs     PKCE flow, app-token search, link import, top tracks, playlist paging
  pages.mjs       Public privacy / terms / account-deletion pages (from legal.json)
  test/           node:test integration suite
assets/           App icon, adaptive icon layers, splash marks (generated by scripts/generate-icons.cjs)
```

## Security & privacy

- Passwords hashed with scrypt; sessions are random 256-bit tokens stored only as SHA-256 digests, kept in the device keychain/keystore.
- Spotify tokens encrypted at rest with AES-256-GCM. The Spotify client secret and TMDB key stay on the server.
- Visibility and blocks are enforced in SQL on every read path, including item averages and profile top fives; validation on every write.
- Catalog providers receive only search terms, sent from the server rather than the person’s device.
- Rate limiting on authentication, recovery, catalog search, and global request volume; strict CORS allow-list; `nosniff`, `no-referrer`, and `no-store` headers.
- No analytics SDKs, ads, or third-party trackers.

## Known limitations

- Feed and discovery use signed cursor pages; profiles and the sync snapshot remain capped, while clubs/library still have bounded lists.
- Mood board and profile photos are stored inline in the database; move them to object storage before scaling.
- Push delivery requires an installed native build with FCM/APNs credentials and server opt-in. It has not been tested on a physical phone here.
- The same title found through two sources (for example Apple and Spotify) counts as two items for averages.
- Riffs doesn’t stream music or video.

## Try a populated local community

Run `npm run api:demo` and `npx expo start --web`. The initial demo seed adds 12 explicitly labelled bot profiles and one test listener, with 178 posts, 125 ratings, 122 comments, three listening clubs, polls, pods, rankings, mood boards, follows, and activity. Existing accounts and posts are preserved. Re-running the seed keeps edits and interactions rather than resetting the community. `npm run demo:seed` seeds without enabling live replies.

Optional test sign-in: `listener@demo.margin.invalid` / `MarginDemo2026!`. Bot replies, reactions, and poll votes run only on new public posts by this demo listener; private posts and real accounts are excluded. Replies appear after the next refresh. Bots use unknown random passwords and are clearly named `· Bot`. Create your own account and choose your own profile name/username through **Create account**; no personal identities are generated for you.

`npm run demo:clear` removes the demo accounts and their content through database cascades, preserving real accounts. Real interactions attached to deleted demo posts are removed with those posts. Demo tooling refuses production or remote databases.

## Email OTP sign-in

Account creation collects a name, username, email, and password. Without email delivery configured, password signup and sign-in work in production and development; email addresses remain unverified. With Resend configured, the app requests a purpose-bound email code and creates the account only after verification. Existing accounts can verify under Settings → Messages, alerts & email. **Sign in → Email code** becomes an alternative to password sign-in when delivery is configured and verifies email ownership; it is not a second-factor MFA flow.

To enable email features later, copy `server/.env.example` to `server/.env`, set `RESEND_API_KEY` and a verified `EMAIL_FROM`, and restart the API. These credentials stay on the server. Resend setup is documented in its [send-email API guide](https://resend.com/docs/api-reference/emails/send-email). Without them, the sign-in screen offers password login and hides email-code and password-recovery controls. The same provider settings enable password reset emails.

Codes expire after ten minutes, are single-use, allow five wrong attempts, and are tied to the requesting sign-in screen. A new request requires a minute between sends, with five sends per email per hour and an additional IP limit. Codes use keyed digests in the database and never appear in API responses or server logs. Provider delivery failure invalidates that code. Unregistered addresses receive the same response and email but cannot sign in until they create an account.

See [READINESS.md](READINESS.md) for what is verified and what still needs production/device setup.

## Push alerts

Install/build with the `expo-notifications` plugin, configure FCM v1 for Android and APNs for iOS through EAS, then set `PUSH_ENABLED=1` on the API. If Expo push access-token security is enabled, also set the server-only `EXPO_ACCESS_TOKEN`. Follow [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/). Users opt in under Settings → Messages, alerts & email on a physical phone; the browser explains that alerts require the installed app.

Device tokens belong to an authenticated session and are removed when that session is revoked. A durable queue checks current visibility, blocks, membership, and preferences before delivery. It retries failures with backoff, checks Expo receipts, and removes unregistered devices. Alert bodies are generic and omit message/post text. In-app activity remains available without push. Run one API worker per SQLite database; horizontal deployment needs coordination of queue claims before running multiple workers against a shared remote database.

## Playlist sources without Spotify API

Create → Bring a playlist accepts full Spotify, Apple Music, or Deezer playlist URLs. Public Deezer links read at most 100 tracks through its public catalog API, subject to provider availability. Spotify oEmbed supplies a playlist title/source, not its songs; Apple Music links preserve the source without claiming automatic import. Paste one `Song | Artist` per line or an export CSV with `Track Name` and `Artist Name(s)` columns. Exact keyless catalog matches are selected; ambiguous matches need confirmation. Unmatched picks can be added with search or skipped. Only reviewed picks become the new pod, and its original playlist link stays attached. No audio is copied or played.

## License

No open-source license has been granted. All rights reserved by the project owner.
