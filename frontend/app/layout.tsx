import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/ui/Sidebar';
import Topbar from '@/components/ui/Topbar';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Family Organizer',
  description: 'Family wall calendar and organizer',
  viewport: 'width=device-width, initial-scale=1, user-scalable=no',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${geist.className} bg-[#f5f2ee] text-[#1a1814] min-h-screen flex flex-col`}>
        {/* Topbar */}
        <Topbar />

        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>
          {/* Sidebar */}
          <Sidebar />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}