# Riffs landing page

A Next.js static site: what Riffs is, and where to download it. It lives apart from the Expo app.

```bash
cd site
npm install
npm run dev      # http://localhost:3005
npm run build    # static files in site/out/, host anywhere
```

Store links come from environment variables at build time. Each button says "Coming soon" until its link is set:

- `NEXT_PUBLIC_IOS_URL`: App Store listing
- `NEXT_PUBLIC_ANDROID_URL`: Play Store listing or APK
- `NEXT_PUBLIC_WEB_APP_URL`: optional "Open in browser" button
- `NEXT_PUBLIC_SITE_URL`: canonical URL for social previews (default `https://riffs.app`)

Brand images in `public/` and the icons in `app/` are copies of `assets/brand/` in the app. Regenerate them with `node scripts/brand-from-logo.cjs` and copy them again.
