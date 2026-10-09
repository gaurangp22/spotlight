# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Music fans sharing opinions and finding people with similar taste. The owner and Ayush (Mandi) will create and manage their own profiles.

## Product Purpose

Riffs is a music-first social app inspired by Equals and Podiums: rate and rank music, post takes, discuss picks, collect music with friends, and discover taste matches.

## Capabilities and Constraints

Expo/React Native for Android, iOS and web; Node API with SQLite locally and optional Turso. User-approved continuations add onboarding, profile photos, follow lists, Listen Later, replies/mentions, weekly listening clubs, direct/group messages, push support, signup email verification, cursor feeds/discovery, a private listening diary, and playlist sources/import. Spotify API is not a dependency of the new features: For You uses Riffs artists/ratings/follows/diary; the diary records manual logs, not external playback. Public Deezer playlists can import tracks; Spotify/Apple Music links preserve sources and use pasted track lists or manual picks. Email provider setup is deferred by the owner. Playback remains disabled by default. Push delivery needs configured native credentials/builds; native video needs compilation and device verification. No deployment or store release is claimed.

## Brand Commitments

Keep the name Riffs and the established dark music-first interface. The current DESIGN.md and shared components govern extensions.

## Evidence on Hand

The local demo has explicitly labelled bots and real catalog metadata. Demo activity is synthetic. Existing user data must be preserved.

## Product Principles

- People choose their own identities and what they share.
- Music opinions and conversations lead the experience.
- Server visibility and blocking rules apply to every feature.
- Keep drafts and provide recovery when a request fails.

## Open Decisions

Public hosting, production provider credentials, launch platforms, and store release timing remain undecided.
