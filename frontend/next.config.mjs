import withPWA from '@ducanh2912/next-pwa';

const pwa = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  workboxOptions: {
    clientsClaim: true,
    runtimeCaching: [
      // SSE-Endpoint und events-Route niemals cachen
      {
        urlPattern: /\/api\/events/,
        handler: 'NetworkOnly',
      },
      // Schreibende Requests niemals cachen
      {
        urlPattern: ({ request }) =>
          request.method === 'POST' ||
          request.method === 'PATCH' ||
          request.method === 'DELETE',
        handler: 'NetworkOnly',
      },
      // API GET-Calls: bei Offline letzten Stand zeigen
      {
        urlPattern: /\/api\/.*/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 2,
          },
          cacheableResponse: {
            statuses: [200],
          },
        },
      },
      // Statische Assets: Netz bevorzugen, bei Ausfall Cache
      {
        urlPattern: /^https?.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'static-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24,
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async rewrites() {
    // Nur für lokale Entwicklung relevant (BACKEND_URL zeigt auf localhost:3001).
    // In Production läuft alles über Traefik: /api/* → Backend-Container direkt.
    // NEXT_PUBLIC_API_URL wird im Frontend-Code NICHT mehr verwendet —
    // alle API-Calls gehen relativ (/api/...) und werden von Traefik geroutet.
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default pwa(nextConfig);
