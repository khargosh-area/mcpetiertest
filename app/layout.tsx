import '@fontsource-variable/inter';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TierTestBot · Control Panel',
  description:
    'Deploy Hatch style control panel for TierTestBot — live status, guilds, tier leaderboards, logs and one-click Vercel deployment.'
};

export const viewport: Viewport = {
  themeColor: '#06070c',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
