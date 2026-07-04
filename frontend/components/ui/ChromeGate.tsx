'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/ui/Sidebar';
import { BurnInProvider } from '@/components/burn-in';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

let unauthorizedRedirectInstalled = false;

// Fängt abgelaufene/fehlende Sessions bei client-seitigen fetch()-Aufrufen ab —
// Traefiks ForwardAuth-302 greift nur bei vollen Seitennavigationen, nicht bei SPA-Fetches.
function installUnauthorizedRedirect() {
  if (unauthorizedRedirectInstalled) return;
  unauthorizedRedirectInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    const input = args[0];
    const url = typeof input === 'string' ? input : (input as Request).url ?? '';
    if (response.status === 401 && url.includes('/api/') && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return response;
  };
}

export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    installUnauthorizedRedirect();
  }, []);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <BurnInProvider>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', minWidth: 0 }}>
          <OfflineBanner />
          <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {children}
          </main>
        </div>
      </BurnInProvider>
    </>
  );
}
