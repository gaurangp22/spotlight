# MARGIN

An Android-first social music app built with Expo SDK 57, React Native, TypeScript, and a Node 24 API. Phones are the primary design target. No Supabase: local persistence uses SQLite, with a server-side adapter for Turso **libSQL**.

## Run locally

Use Node 24 or newer. From this folder:

```sh
npm ci
npm --prefix server ci
npm run api
```

Keep that terminal open. In another terminal, run `npm start` for Android development, or `npm run web` for http://localhost:8081. Create accounts in separate browser profiles to test social interactions. Visitors see labeled examples; signed-in feeds contain actual account posts.

The API listens on port 8787. Database files and the automatically generated token encryption key are in `server/data/`, excluded from Git. Preserve both for backups. Published posts sync through the API; drafts save separately for each account on its device.

## Android phone

Keep the computer and phone on the same Wi-Fi. Development discovers the Metro host automatically. If needed, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8787`, and restart Metro. Allow connections to ports 8787 and 8081 on the computer.

Spotify requires an installed development or preview build to receive its callback. Expo Go can preview other screens, subject to SDK 57 support. With Android Studio, SDK 36, and JDK 21 installed, run `npm run android`.

To build an internal APK in Windows PowerShell:

```powershell
$env:MARGIN_LOCAL_PREVIEW='1'
$env:EXPO_PUBLIC_API_URL='http://YOUR_COMPUTER_LAN_IP:8787'
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA/Android/Sdk"
npx expo prebuild --platform android --no-install
Set-Location android
./gradlew.bat assembleRelease --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. This local APK permits HTTP, embeds your computer's address, and uses a testing signing key. The API must remain running. For production, use HTTPS, omit `MARGIN_LOCAL_PREVIEW`, regenerate native configuration, and configure release signing. Native directories are generated and excluded from Git. `eas.json` also includes development, preview APK, and production app-bundle profiles; EAS requires an Expo account/project.

## Functional flows

- Register, sign in/out, edit profile, change password, and delete account.
- Search music and import Spotify playlists when configured; manually rank up to 100 unique picks or use Battle Mode.
- Save device drafts, recover earlier ranking drafts, edit/delete posts, remix, and compare shared-pick order.
- Make mood boards with songs, compressed photos, notes, and four color stories.
- Discover people, follow/unfollow, react, comment on posts or individual songs, and view in-app activity.
- Enforce public/followers/private access on the server; block people, report posts, and moderate reports.
- Export designed PNG cards through Android's share sheet or browser download.

The app does not stream music or connect to Apple Music. Before Spotify is connected, search uses public iTunes catalog metadata and is labeled Catalog. Starter examples work without search access. Battle results use win counts, with ties preserving starting order; early results remain editable.

## Live configuration later

Copy `server/.env.example` to `server/.env`. Database tokens, encryption keys, email credentials, and admin tokens belong **only on the server**. The mobile environment contains only the API URL and optional public web URL.

For Turso, set a libSQL-compatible `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Schema initialization runs at startup. Switching does not migrate local records; preserve the database and plan an explicit import. Turso's newer engine uses another client and is not the adapter implemented here.

For Spotify, set `SPOTIFY_CLIENT_ID` and register the exact `SPOTIFY_REDIRECT_URI` pointing to the API's `/api/spotify/callback`. The server completes PKCE and returns to `marginmusic://spotify-callback` on Android. A phone needs an HTTPS API/callback reachable from its browser. Web testing can use an explicit `127.0.0.1` loopback callback; Spotify does not accept `localhost`. Configure `WEB_APP_URL` and `ALLOWED_ORIGINS` for your web origin. Development-mode limits/access approval still apply. See [Spotify redirect rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) and [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

For password recovery, set `RESEND_API_KEY`, a verified `EMAIL_FROM`, and `WEB_APP_URL` hosting the reset-password page. Recovery is unavailable until configured. Activity notifications work locally; push notifications are not implemented.

Deployment starting points: `server/Dockerfile`, `server/compose.yaml`, and `server/Caddyfile.example`. Set `NODE_ENV=production` and a stable 64-hex-character `TOKEN_ENCRYPTION_KEY`. Configure only known proxy addresses in `TRUSTED_PROXY_IPS`. Preserve local data/encryption keys. Public deployments need HTTPS.

For moderation, configure a server-only `ADMIN_TOKEN` of at least 32 characters, then from `server/`:

```sh
node --env-file=.env admin.mjs reports
node --env-file=.env admin.mjs dismiss REPORT_ID
node --env-file=.env admin.mjs remove REPORT_ID
```

## Checks and release boundaries

```sh
npm run typecheck
npm run lint
npm test
npx expo install --check
```

API tests cover accounts/sessions, privacy, cross-account mutations, blocks, comments/reactions, reports/moderation, recovery, SQLite persistence, and mocked Spotify PKCE/token refresh. Browser QA exercises two accounts through publishing, following, reactions/comments, Battle Mode, comparison, mood boards, photo upload, PNG export, profile editing, and privacy changes. Browser checks cannot establish native Back, keyboard/insets, font scaling, or share-sheet behavior.

Live Turso, Spotify, and email delivery have not been tested against real accounts. Before a public business launch, complete native device QA, signing, backups, monitoring, store/privacy disclosures, and Spotify access approval. Expo's dependency tree has upstream npm advisories requiring assessment before public release; do not force incompatible SDK downgrades. Feeds load the latest 200 accessible posts; discovery loads the latest 100 people. Larger communities need pagination. Photos are stored inline locally; object storage is a later scaling step.

## Source map

- `src/app/`: phone screens and Expo Router navigation.
- `src/store/AppContext.tsx`: account state, API sync, and device drafts.
- `src/lib/`: API/session handling, search, comparison, and sharing links.
- `src/ui/`: shared editorial controls, forms, and mood themes.
- `server/`: API, SQLite/Turso adapter, schema, Spotify, moderation, and tests.
