# MARGIN

An original Android-first social music prototype, built with React Native, Expo SDK 57, TypeScript, and Expo Router.

## Try it on Android

1. Install **Expo Go** on your Android phone.
2. Open a terminal in this folder and run:

   ```sh
   npm install
   npm start
   ```

3. Keep the phone and computer on the same Wi-Fi. Scan the terminal QR code in Expo Go.
4. If your network blocks the connection, try `npx expo start --tunnel`.

The project's dependencies are already installed in this workspace. [Expo's setup guide](https://docs.expo.dev/get-started/set-up-your-environment/) explains Expo Go and development builds.

## Try the core loop

- Open Mandi's example Radiohead ranking in **Following**.
- Tap **Make mine**. The same picks start in alphabetical order, without carrying over the original ranking.
- Change the order with the arrow controls, or use **Battle Mode**.
- Publish your version locally, then compare it with Mandi's order.
- Open **Share card**, choose Night or Paper, and share a PNG through Android's share sheet.
- Make your own ranking with live song/album search under **Add music**.

## What works

- Public music metadata search using Apple's iTunes Search API, with artwork and offline starter picks.
- Persistent local rankings, active drafts, recoverable previous drafts, and visibility choices.
- Manual reorder, pairwise Battle Mode for all selected picks, and an option to stop and refine early results.
- Example following feed and profiles, local follow toggles, reactions, item-specific comments, and remixing.
- Comparison based on normalized shared-pick order, including the biggest disagreement.
- Designed PNG ranking cards and native file sharing.
- Original app icon, Android back navigation, and system safe-area handling.

## Prototype boundaries

This is a local prototype. **No account, Spotify connection, real social graph, or server is connected.** Example people, posts, and activity counts are labeled. Publishing saves on this device; public/followers/private choices are metadata for the future backend, not remote access controls. Search and remote artwork need internet; local rankings remain available offline.

Battle results use head-to-head win counts, with ties preserving the starting order. Early results are provisional and can be edited. A comparison describes ranking agreement, not a psychological or overall listening profile.

Moodboards, capsules, music streaming, video export, notifications, moderation, and shared backend functionality are later product layers.

## Checks

```sh
npx tsc --noEmit
npx expo lint
node scripts/test-core.cjs
npx expo export --platform android --output-dir dist-android
```

The Android JavaScript export is a bundle check, **not an APK**. Native device testing is still required for keyboard behavior, font scaling, image capture, and share-sheet behavior. This workspace has no Android SDK or emulator.

## Build an installable APK later

`eas.json` includes an internal preview APK profile. Sign in to your Expo account, initialize EAS for this project, and run:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

An EAS project/account is required. The working product name and Android package ID should be finalized before release. See [Expo's build guide](https://docs.expo.dev/build/setup/).

## Source map

- `src/app/` — Expo Router screens and navigation.
- `src/store/AppContext.tsx` — local state and AsyncStorage persistence.
- `src/lib/music.ts` — music metadata search.
- `src/lib/compare.ts` — ranking comparison.
- `src/lib/sample.ts` — labeled example content.
- `src/ui/` — shared components and color roles.
