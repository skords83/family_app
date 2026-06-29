'use client';

import { useEffect, useState } from 'react';

export interface ApplianceNotification {
  id: number;
  appliance: 'washer' | 'dryer';
}

const LABELS: Record<ApplianceNotification['appliance'], { icon: string; text: string }> = {
  washer: { icon: 'ti-wash', text: 'Waschmaschine fertig!' },
  dryer:  { icon: 'ti-wind', text: 'Trockner fertig!' },
};

const AUTO_DISMISS_MS = 30_000;

function Toast({ notification, onDismiss }: {
  notification: ApplianceNotification;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);
  const { icon, text } = LABELS[notification.appliance];

  useEffect(() => {
    // Slight delay so CSS transition plays on mount
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(notification.id), 300);
    }, AUTO_DISMISS_MS);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [notification.id, onDismiss]);

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(() => onDismiss(notification.id), 300); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        borderRadius: 16,
        background: '#fff',
        boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
        border: '1px solid rgba(0,0,0,0.07)',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'opacity 0.3s, transform 0.3s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        minWidth: 240,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 22, color: '#3b82f6' }} aria-hidden="true" />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1814', lineHeight: 1.2 }}>
          {text}
        </div>
        <div style={{ fontSize: 12, color: '#a09d99', marginTop: 2 }}>
          Zum Schließen tippen
        </div>
      </div>
    </div>
  );
}

export function ApplianceToastContainer({ notifications, onDismiss }: {
  notifications: ApplianceNotification[];
  onDismiss: (id: number) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 32,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {notifications.map(n => (
        <div key={n.id} style={{ pointerEvents: 'auto' }}>
          <Toast notification={n} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
