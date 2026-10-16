import type { NextConfig } from 'next';

// A static export: the site is plain HTML/CSS/JS and can be hosted anywhere (Vercel, Netlify, GitHub Pages, a bucket).
const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default config;
