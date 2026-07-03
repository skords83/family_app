'use client';

import { useClientDateStr } from '@/hooks/useClientDate';

type Slot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface PlannedRecipe {
  id: string;
  date: string;
  slot: Slot;
  recipeName: string | null;
}

interface MealsWidgetProps {
  byDate?: Record<string, Partial<Record<Slot, PlannedRecipe[]>>>;
  fetched_at?: string;
  loading?: boolean;
}

const SLOT_LABELS: Record<Slot, string> = {
  Breakfast: 'Frühstück',
  Lunch: 'Mittag',
  Dinner: 'Abend',
  Snack: 'Snack',
};
const SLOT_ICONS: Record<Slot, { icon: string; color: string }> = {
  Breakfast: { icon: 'ti-sunrise', color: '#e0a020' },
  Lunch: { icon: 'ti-tools-kitchen-2', color: '#378ADD' },
  Dinner: { icon: 'ti-moon-stars', color: '#6366f1' },
  Snack: { icon: 'ti-cookie', color: '#e85d3a' },
};
const SLOT_ORDER: Slot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** Ortszeit-sicheres YYYY-MM-DD — nie toISOString() (UTC-Versatz!). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

export default function MealsWidget({ byDate = {}, fetched_at, loading }: MealsWidgetProps) {
  // null on server render → kein Hydration-Mismatch
  const todayStr = useClientDateStr();

  if (loading) {
    return (
      <div className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--family-surface)', border: '0.5px solid var(--family-border)' }}>
        <div className="h-4 rounded w-24 mb-3" style={{ background: '#e8e4de' }} />
        {[0, 1].map(i => (
          <div key={i} className="mb-3">
            <div className="h-3 rounded w-16 mb-2" style={{ background: '#e8e4de' }} />
            <div className="h-6 rounded mb-1" style={{ background: '#e8e4de' }} />
          </div>
        ))}
      </div>
    );
  }

  const stale = isStale(fetched_at);

  // Vor Hydration: leere Shell ohne datumsabhängigen Inhalt
  if (!todayStr) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'var(--family-surface)', border: '0.5px solid var(--family-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
            Essensplan
          </h3>
        </div>
      </div>
    );
  }

  // Nur heute anzeigen
  const todaySlots = byDate[todayStr] ?? {};
  const presentSlots = SLOT_ORDER.filter(s => todaySlots[s]?.length);

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--family-surface)', border: '0.5px solid var(--family-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
          Essensplan
        </h3>
        <div className="flex items-center gap-1.5">
          {fetched_at && (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stale ? '#e0a020' : '#3a9a6e', flexShrink: 0, display: 'inline-block' }} />
              <span className="text-[10px] font-sans" style={{ color: '#a09d99' }}>
                {stale ? 'veraltet' : 'aktuell'}
              </span>
            </>
          )}
        </div>
      </div>

      {presentSlots.length === 0 ? (
        <p className="text-sm font-sans py-4 text-center" style={{ color: '#a09d99' }}>
          Kein Essensplan verfügbar
        </p>
      ) : (
        <div className="space-y-1">
          {presentSlots.map(slot => (
            <div key={slot} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--family-surface2)' }}>
              <i className={`ti ${SLOT_ICONS[slot].icon} flex-shrink-0`} aria-hidden="true" style={{ fontSize: 15, color: SLOT_ICONS[slot].color }} />
              <div>
                <p className="text-[10px] font-sans font-medium" style={{ color: '#6b6760' }}>{SLOT_LABELS[slot]}</p>
                <p className="text-xs font-sans" style={{ color: '#1a1814' }}>
                  {todaySlots[slot]!.map(r => r.recipeName ?? '–').join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}