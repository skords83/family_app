import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/ui/Sidebar';
import Topbar from '@/components/ui/Topbar';

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
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`} style={{ background: '#f5f2ee', color: '#1a1814' }}>
        <Topbar />
        {/* flex-1 + min-h-0 so sidebar stretches full height */}
        <div className="flex flex-1 min-h-0" style={{ height: 'calc(100vh - 68px)' }}>
          <Sidebar />
          <main className="flex-1 overflow-y-auto min-h-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}