import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GHOAST — Ghost follower cleanup, privately',
    short_name: 'GHOAST',
    description:
      'See exactly who doesn’t follow you back — from your own Instagram export, read on your device. Never your password.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D0A14',
    theme_color: '#0D0A14',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
