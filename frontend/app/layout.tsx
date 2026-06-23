import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/ui/Sidebar';
import { BurnInProvider } from '@/components/burn-in';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Family Organizer',
  description: 'Family wall calendar and organizer',
  viewport: 'width=device-width, initial-scale=1, user-scalable=no',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.x/dist/tabler-icons.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f5f2ee" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={inter.className}
        style={{
          background: '#f5f2ee',
          color: '#1a1814',
          height: '100dvh',
          display: 'flex',
          overflow: 'hidden',
          margin: 0,
        }}
      >
        <Sidebar />
        <BurnInProvider>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', minWidth: 0 }}>
            <OfflineBanner />
            <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {children}
            </main>
          </div>
        </BurnInProvider>
      </body>
    </html>
  );
}