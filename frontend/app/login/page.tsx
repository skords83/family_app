'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PinModal from '@/components/ui/PinModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const POLL_INTERVAL_MS = 1500;

export default function LoginPage() {
  const router = useRouter();
  const [showPinModal, setShowPinModal] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimTicket = useCallback(async () => {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/nfc-login/claim`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) {
        router.push('/');
        return;
      }
      setError('Login-Versuch abgelaufen — bitte Tag erneut anlegen.');
    } catch {
      setError('Verbindung zum Server fehlgeschlagen.');
    } finally {
      setClaiming(false);
    }
  }, [router]);

  useEffect(() => {
    if (showPinModal || claiming) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/nfc-login/poll`, {
          credentials: 'same-origin',
        });
        if (!res.ok || cancelled) return;
        const data: { pending: boolean } = await res.json();
        if (data.pending && !cancelled) {
          await claimTicket();
        }
      } catch {
        // Netzwerkfehler beim Polling: beim nächsten Intervall erneut versuchen.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showPinModal, claiming, claimTicket]);

  const verifyPin = async (pin: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ pin }),
    });
    return res.ok;
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{ background: 'var(--family-bg)', color: 'var(--family-text)' }}
    >
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
        style={{ background: 'var(--family-surface)', border: '1px solid var(--family-border)' }}
      >
        <i
          className={`ti ti-nfc text-5xl ${claiming ? 'animate-pulse' : ''}`}
          style={{ color: 'var(--family-accent)' }}
        />
      </div>

      <h1 className="text-2xl font-bold mb-2">Family Organizer</h1>
      <p style={{ color: 'var(--family-text2)' }} className="mb-10">
        {claiming ? 'Anmeldung läuft …' : 'Bitte NFC-Tag an den Leser halten'}
      </p>

      {error && <p className="text-sm mb-6" style={{ color: 'var(--family-accent)' }}>{error}</p>}

      <button
        onClick={() => setShowPinModal(true)}
        className="text-sm underline underline-offset-4"
        style={{ color: 'var(--family-text3)' }}
      >
        Mit PIN anmelden
      </button>

      {showPinModal && (
        <PinModal
          title="PIN eingeben"
          verify={verifyPin}
          onSuccess={() => router.push('/')}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}
