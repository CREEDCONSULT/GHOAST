import type { Metadata } from 'next';
import { Outfit, DM_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Ghoast — See Who Ghosted Your Count',
  description:
    'Instagram follower intelligence tool. Find your ghosts, rank them by 5 dimensions, bulk-unfollow automatically with Instagram-safe delays.',
  keywords: ['instagram', 'followers', 'unfollow', 'ghost', 'follower ratio', 'cleanup'],
  authors: [{ name: 'Ghoast' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://ghoast.app'),
  openGraph: {
    type: 'website',
    siteName: 'Ghoast',
    title: 'Ghoast — See Who Ghosted Your Count',
    description:
      'Instagram follower intelligence tool. Find your ghosts, rank them, bulk-unfollow automatically.',
    url: 'https://ghoast.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Ghoast — Instagram Ghost Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ghoast — See Who Ghosted Your Count',
    description:
      'Instagram follower intelligence tool. Find your ghosts, rank them, bulk-unfollow automatically.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://ghoast.app',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <body style={{ fontFamily: "var(--font-outfit, 'Outfit', sans-serif)" }}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
