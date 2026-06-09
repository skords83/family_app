'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

type Slot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface PlannedRecipe {
  id: string;
  date: string;
  slot: Slot;
  recipeName: string | null;
  recipeImage: string | null;
  imageUrl: string | null;
  servings: number | null;
  calories: number | null;
  tags?: string[];
}

const SLOT_LABELS: Record<Slot, string> = {
  Breakfast: 'Früh',
  Lunch: 'Mittag',
  Dinner: 'Abend',
  Snack: 'Snack',
};
const SLOT_ICONS: Record<Slot, string> = {
  Breakfast: '🌅', Lunch: '🍽️', Dinner: '🌙', Snack: '🍎',
};
const SLOT_BG: Record<Slot, string> = {
  Breakfast: '#fef9e3', Lunch: '#fff5f3', Dinner: '#f0f7ff', Snack: '#f2fbf2',
};
const SLOT_ORDER: Slot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayStr() { return toLocalDateStr(new Date()); }
function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}
function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
}
function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}
function longDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Passende Emoji-Hintergrundfarbe je nach Gericht (einfaches Hashing)
const SWATCH_COLORS = ['#f0ede0','#f5ede0','#edeee0','#f5f0e0','#f0e8e8','#e8f0e8','#e8eef0'];
function swatchColor(name: string | null, idx: number): string {
  if (!name) return SWATCH_COLORS[idx % SWATCH_COLORS.length];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return SWATCH_COLORS[Math.abs(h) % SWATCH_COLORS.length];
}

export default function MealsPage() {
  const [byDate, setByDate] = useState<Record<string, Partial<Record<Slot, PlannedRecipe[]>>>>({});
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/widgets/meals?range=month`)
      .then(r => r.json())
      .then(data => {
        if (data?.byDate) { setByDate(data.byDate); setFetchedAt(data.fetched_at); }
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const today = getTodayStr();
  const sortedDates = Object.keys(byDate).filter(d => d >= today).sort().slice(0, 7);
  const todayDate = sortedDates[0] === today ? today : null;
  const restDates = sortedDates.filter(d => d !== today);

  return (
    <div>
      <PageHeader title="Essensplan" variant="page" />

      <div className="px-6 pb-6" style={{ maxWidth: 680 }}>

        {/* Refresh */}
        <div className="flex justify-end mb-4">
          <button onClick={load}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/5"
            style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760' }} title="Aktualisieren">
            <i className="ti ti-refresh" style={{ fontSize: 17 }} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl animate-pulse" style={{ background: '#e8e4de', height: 200 }} />
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[0,1,2,3].map(i => <div key={i} className="rounded-2xl animate-pulse" style={{ background: '#e8e4de', height: 110 }} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && (error || sortedDates.length === 0) && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <i className="ti ti-bowl" style={{ fontSize: 32, color: '#d8d4cf', display: 'block', marginBottom: 12 }} />
            <p className="text-sm font-sans font-medium mb-1" style={{ color: '#1a1814' }}>Kein Essensplan verfügbar</p>
            <p className="text-xs font-sans mb-4" style={{ color: '#a09d99' }}>Norish liefert noch keine Daten für diese Woche.</p>
            <div className="rounded-xl px-4 py-3 flex items-start gap-2 text-left" style={{ background: '#fff5f3', border: '0.5px solid #e85d3a30' }}>
              <i className="ti ti-plug" style={{ fontSize: 15, color: '#e85d3a', flexShrink: 0, marginTop: 1 }} />
              <span className="text-xs font-sans" style={{ color: '#e85d3a' }}>
                Stelle sicher dass <strong>NORISH_URL</strong> in den Umgebungsvariablen gesetzt ist.
              </span>
            </div>
          </div>
        )}

        {!loading && !error && sortedDates.length > 0 && (
          <div className="flex flex-col gap-3">

            {/* ── Heute Banner ── */}
            {todayDate && (() => {
              const daySlots = byDate[todayDate] ?? {};
              const dinner = daySlots['Dinner']?.[0];
              const recipe = dinner ?? Object.values(daySlots).flat()[0];
              if (!recipe) return null;
              const tags: string[] = (recipe as any).tags ?? [];
              return (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #e85d3a' }}>
                  {/* Bild oder farbige Fläche */}
                  <div className="relative" style={{ height: 160 }}>
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.recipeName ?? ''} className="w-full h-full object-cover" style={{ display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl" style={{ background: swatchColor(recipe.recipeName, 0), opacity: 0.6 }}>
                        {SLOT_ICONS['Dinner']}
                      </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px' }}>
                      <div className="font-sans" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>
                        Heute Abend · {longDay(todayDate)}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 400, color: '#fff', lineHeight: 1.25, fontFamily: 'Georgia, serif' }}>
                        {recipe.recipeName ?? 'Kein Rezeptname'}
                      </div>
                    </div>
                  </div>
                  {/* Meta-Zeile */}
                  <div className="flex items-center flex-wrap gap-2 px-4 py-2.5">
                    {tags.slice(0, 3).map((t, i) => (
                      <span key={i} className="font-sans font-semibold" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#f0ede8', color: '#5f5e5a', border: '0.5px solid #d3d1c7' }}>
                        {t.toUpperCase()}
                      </span>
                    ))}
                    {(tags.length > 0 || recipe.calories || recipe.servings) && tags.length > 0 && (
                      <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
                    )}
                    {recipe.calories && (
                      <span className="font-sans flex items-center gap-1" style={{ fontSize: 11, color: '#a09d99' }}>
                        <i className="ti ti-flame" style={{ fontSize: 12 }} aria-hidden="true" /> {recipe.calories} kcal
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="font-sans flex items-center gap-1" style={{ fontSize: 11, color: '#a09d99' }}>
                        <i className="ti ti-users" style={{ fontSize: 12 }} aria-hidden="true" /> {recipe.servings} Port.
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Rest: 2-Spalten-Grid ── */}
            {restDates.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {restDates.map((date, idx) => {
                  const daySlots = byDate[date] ?? {};
                  const weekend = isWeekend(date);

                  if (weekend) {
                    // Wochenende: alle Slots als Zeilen
                    const presentSlots = SLOT_ORDER.filter(s => daySlots[s]?.length);
                    return (
                      <div key={date} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                        {/* Kopf */}
                        <div className="px-3 py-2.5" style={{ background: '#fafaf9', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                          <div className="font-sans font-semibold" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a7874' }}>{shortDay(date)}</div>
                          <div style={{ fontSize: 15, fontWeight: 400, fontFamily: 'Georgia, serif', color: '#1a1814' }}>{shortDate(date)}</div>
                        </div>
                        {/* Slots */}
                        <div className="px-3 py-2.5 flex flex-col gap-2">
                          {presentSlots.map(slot => {
                            const r = daySlots[slot]![0];
                            return (
                              <div key={slot} className="flex items-center gap-2">
                                <div className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 22, height: 22, background: SLOT_BG[slot], fontSize: 12 }}>
                                  {SLOT_ICONS[slot]}
                                </div>
                                <div className="font-sans flex-shrink-0" style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#a09d99', width: 36 }}>
                                  {SLOT_LABELS[slot]}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="font-sans" style={{ fontSize: 11, color: '#1a1814', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.recipeName ?? '–'}
                                  </div>
                                  {(r.calories || r.servings) && (
                                    <div className="font-sans" style={{ fontSize: 10, color: '#a09d99' }}>
                                      {[r.calories ? `${r.calories} kcal` : null, r.servings ? `${r.servings} Port.` : null].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {presentSlots.length === 0 && (
                            <p className="font-sans text-center py-1" style={{ fontSize: 11, color: '#c8c4c0' }}>Keine Einträge</p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Wochentag: nur Abendessen, mit Swatch oben
                  const dinner = daySlots['Dinner']?.[0];
                  const recipe = dinner ?? Object.values(daySlots).flat()[0];
                  const slot: Slot = dinner ? 'Dinner' : (Object.keys(daySlots).find(s => daySlots[s as Slot]?.length) as Slot | undefined) ?? 'Dinner';

                  return (
                    <div key={date} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                      {/* Farbfläche */}
                      <div className="flex items-center justify-center" style={{ height: 52, background: recipe ? swatchColor(recipe.recipeName, idx) : '#f0ede8', fontSize: 24 }}>
                        {recipe ? SLOT_ICONS[slot] : <i className="ti ti-moon" style={{ fontSize: 20, color: '#c8c4c0' }} aria-hidden="true" />}
                      </div>
                      {/* Info */}
                      <div className="px-3 py-2.5">
                        <div className="font-sans font-semibold" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a09d99', marginBottom: 3 }}>
                          {shortDay(date)} · {shortDate(date)}
                        </div>
                        <div className="font-sans" style={{ fontSize: 12, color: '#1a1814', lineHeight: 1.35 }}>
                          {recipe?.recipeName ?? <span style={{ color: '#c8c4c0' }}>Kein Abendessen geplant</span>}
                        </div>
                        {recipe && (recipe.calories || recipe.servings) && (
                          <div className="font-sans mt-1" style={{ fontSize: 10, color: '#a09d99' }}>
                            {[recipe.calories ? `${recipe.calories} kcal` : null, recipe.servings ? `${recipe.servings} Port.` : null].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}