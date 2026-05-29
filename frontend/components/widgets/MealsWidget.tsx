'use client';

interface MealDay {
  date: string;
  lunch: string;
  dinner: string;
}

interface MealsWidgetProps {
  days?: MealDay[];
  fetched_at?: string;
  loading?: boolean;
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

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

export default function MealsWidget({ days = [], fetched_at, loading }: MealsWidgetProps) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-24 mb-3" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="mb-3">
            <div className="h-3 bg-slate-700 rounded w-16 mb-2" />
            <div className="h-6 bg-slate-700 rounded mb-1" />
            <div className="h-6 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const stale = isStale(fetched_at);
  const today = new Date().toISOString().split('T')[0];

  // Show today + next 3 days
  const relevantDays = days.filter((d) => d.date >= today).slice(0, 4);

  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Essensplan</h3>
        <div className="flex items-center gap-2">
          {stale && <span className="text-xs text-amber-400">⚠ veraltet</span>}
          {fetched_at && (
            <span className="text-xs text-slate-500">
              {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {relevantDays.length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">Kein Essensplan verfügbar</p>
      ) : (
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {relevantDays.map((day) => (
            <div key={day.date}>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">
                {formatDateLabel(day.date)}
              </p>
              <div className="space-y-1">
                {day.lunch && (
                  <div className="flex items-start gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                    <span className="text-base flex-shrink-0">🍽️</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Mittag</p>
                      <p className="text-sm text-slate-200">{day.lunch}</p>
                    </div>
                  </div>
                )}
                {day.dinner && (
                  <div className="flex items-start gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                    <span className="text-base flex-shrink-0">🌙</span>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Abend</p>
                      <p className="text-sm text-slate-200">{day.dinner}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
