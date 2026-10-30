import type { Metadata, Viewport } from 'next';
import { Anton, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// A tall condensed display face, echoing the RIFFS wordmark.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Riffs — your music taste deserves a mic',
  description: 'Rate your favourite tracks, drop album reviews, film countdown videos of your rankings, and find the people whose taste matches yours.',
  openGraph: {
    title: 'Riffs — your music taste deserves a mic',
    description: 'Rate tracks head-to-head, rank your top 10 on camera, and find your taste twins.',
    images: ['/riffs-logo.png'],
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${inter.variable} ${anton.variable}`}>
    <body>{children}</body>
  </html>;
}
