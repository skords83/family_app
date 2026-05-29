'use client';

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

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

export default function MealsWidget({ byDate = {}, fetched_at, loading }: MealsWidgetProps) {
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
  const today = new Date().toISOString().split('T')[0];
  const sortedDates = Object.keys(byDate).filter(d => d >= today).sort().slice(0, 3);

  return (
    <div className="rounded-2xl p-4 border" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.07)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
          Essensplan
        </h3>
        <div className="flex items-center gap-2">
          {stale && <span className="text-xs" style={{ color: '#f0a500' }}>⚠ veraltet</span>}
          {fetched_at && (
            <span className="text-xs font-sans" style={{ color: '#a09d99' }}>
              {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
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
                  {formatDateLabel(date)}
                </p>
                <div className="space-y-1">
                  {presentSlots.map(slot => (
                    <div key={slot} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#f5f2ee' }}>
                      <span className="text-sm flex-shrink-0">{SLOT_ICONS[slot]}</span>
                      <div>
                        <p className="text-[10px] font-sans font-medium" style={{ color: '#a09d99' }}>{SLOT_LABELS[slot]}</p>
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