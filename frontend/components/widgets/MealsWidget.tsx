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
const SLOT_ICONS: Record<Slot, string> = {
  Breakfast: '🌅', Lunch: '🍽️', Dinner: '🌙', Snack: '🍎',
};
const SLOT_ORDER: Slot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** Ortszeit-sicheres YYYY-MM-DD — nie toISOString() (UTC-Versatz!). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
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
      <div className="rounded-2xl p-4 border animate-pulse" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.07)' }}>
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
      <div className="rounded-2xl p-4 border" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.07)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
            Essensplan
          </h3>
        </div>
      </div>
    );
  }

  // ✅ toLocalDateStr statt toISOString — kein UTC-Versatz in Berlin (UTC+2)
  const tomorrowDate = new Date(todayStr + 'T00:00:00');
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tomorrowDate);

  // Nur heute anzeigen — Ausblick gibt es in der Gesamtübersicht
  const sortedDates = Object.keys(byDate).filter(d => d >= todayStr).sort().slice(0, 1);

  return (
    <div className="rounded-2xl p-4 border" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.07)' }}>
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

      {sortedDates.length === 0 ? (
        <p className="text-sm font-sans py-4 text-center" style={{ color: '#a09d99' }}>
          Kein Essensplan verfügbar
        </p>
      ) : (
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {sortedDates.map(date => {
            const daySlots = byDate[date] ?? {};
            const presentSlots = SLOT_ORDER.filter(s => daySlots[s]?.length);
            return (
              <div key={date}>
                <p className="text-[10px] font-sans font-semibold uppercase mb-1.5" style={{ color: '#a09d99' }}>
                  {formatDateLabel(date, todayStr, tomorrowStr)}
                </p>
                <div className="space-y-1">
                  {presentSlots.map(slot => (
                    <div key={slot} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#f5f2ee' }}>
                      <span className="text-sm flex-shrink-0">{SLOT_ICONS[slot]}</span>
                      <div>
                        <p className="text-[10px] font-sans font-medium" style={{ color: '#6b6760' }}>{SLOT_LABELS[slot]}</p>
                        <p className="text-xs font-sans" style={{ color: '#1a1814' }}>
                          {daySlots[slot]!.map(r => r.recipeName ?? '–').join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}