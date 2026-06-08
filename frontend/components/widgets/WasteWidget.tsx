'use client';

import { useClientDateStr } from '@/hooks/useClientDate';

type WasteType = 'bioabfall' | 'restmuell' | 'papier' | 'wertstoff';

interface WasteEvent {
  id: string;
  source: string;
  date: string; // YYYY-MM-DD
  type: WasteType;
  title: string;
  fetched_at: string;
}

interface WasteTodayData {
  active: boolean;
  events: WasteEvent[];
  next: WasteEvent | null;
  fetched_at: string;
}

interface WasteWidgetProps {
  data?: WasteTodayData;
  fetched_at?: string;
  loading?: boolean;
}

const BIN_CONFIG: Record<WasteType, { label: string; bg: string; border: string }> = {
  bioabfall: { label: 'Biotonne',    bg: '#97C459', border: '#3B6D11' },
  restmuell: { label: 'Restmüll',   bg: '#5A5A57', border: '#2C2C2A' },
  papier:    { label: 'Papiertonne', bg: '#378ADD', border: '#0C447C' },
  wertstoff: { label: 'Wertstoff',  bg: '#EF9F27', border: '#854F0B' },
};

function BinIllustration({ type, size = 'md' }: { type: WasteType; size?: 'sm' | 'md' }) {
  const { bg, border } = BIN_CONFIG[type];
  const w = size === 'sm' ? 40 : 52;
  const h = size === 'sm' ? 52 : 68;
  return (
    <div style={{
      width: w, height: h, background: bg,
      borderRadius: '5px 5px 3px 3px',
      position: 'relative', flexShrink: 0,
      border: `2px solid ${border}`,
    }}>
      <div style={{
        position: 'absolute', top: -5, left: 6, right: 6, height: 6,
        background: border, borderRadius: '3px 3px 0 0',
      }} />
      <div style={{
        position: 'absolute', top: 12, left: 5, right: 5, height: 3,
        background: border, borderRadius: 2, opacity: 0.35,
      }} />
    </div>
  );
}

// 26h: Cronjob läuft täglich 03:00, darf also ~26h alt sein
function isStale(fetchedAt?: string, maxAgeMs = 26 * 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

/** Tage bis zu einem YYYY-MM-DD-Datum */
function daysUntil(dateStr: string, todayStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(todayStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/** Wochentag des Vortags (= Rausstell-Tag) */
function prepWeekday(collectionDateStr: string): string {
  const d = new Date(collectionDateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('de-DE', { weekday: 'long' });
}

/** Wochentag des Abfuhrtags */
function collectionWeekday(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long' });
}

export default function WasteWidget({ data, fetched_at, loading }: WasteWidgetProps) {
  // ✅ Only available client-side — null on the first (server) render
  const todayStr = useClientDateStr();

  const card = {
    background: '#fff',
    border: '0.5px solid rgba(0,0,0,0.07)',
    borderRadius: 16,
    padding: 18,
  };

  if (loading) {
    return (
      <div style={{ ...card, height: 96 }} className="animate-pulse">
        <div style={{ background: '#e8e4de', borderRadius: 4, height: 11, width: 80, marginBottom: 14 }} />
        <div style={{ background: '#e8e4de', borderRadius: 6, height: 36 }} />
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div style={card}>
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3"
          style={{ color: '#a09d99' }}>Müllabfuhr</h3>
        <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Termine verfügbar</p>
      </div>
    );
  }

  // Render nothing date-dependent until we're on the client
  if (!todayStr) {
    return (
      <div style={{ ...card, height: 96 }} />
    );
  }

  const stale = isStale(fetched_at ?? data.fetched_at);
  const { active, events } = data;
  const firstDate = events[0].date;
  const isTodayCollection = firstDate === todayStr;
  const binLabels = events.map(e => BIN_CONFIG[e.type].label);

  const header = (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider"
        style={{ color: '#a09d99' }}>Müllabfuhr</h3>
      {stale && <span className="text-xs" style={{ color: '#f0a500' }}>⚠ veraltet</span>}
    </div>
  );

  // ── Passiv ──────────────────────────────────────────────────────────────────
  if (!active) {
    const daysToPrep = daysUntil(firstDate, todayStr) - 1;
    const prep = prepWeekday(firstDate);
    const collection = collectionWeekday(firstDate);
    const daysLabel = daysToPrep <= 1 ? '' : `in ${daysToPrep} Tagen`;

    return (
      <div style={card}>
        {header}
        <div className="flex items-start gap-3">
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {events.map(e => (
              <span key={e.id} className="inline-flex items-center gap-1.5 text-xs font-sans font-medium rounded-full px-2.5 py-1"
                style={{
                  background: `${BIN_CONFIG[e.type].bg}22`,
                  border: `0.5px solid ${BIN_CONFIG[e.type].bg}`,
                  color: BIN_CONFIG[e.type].border,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: BIN_CONFIG[e.type].bg, display: 'inline-block', flexShrink: 0 }} />
                {BIN_CONFIG[e.type].label}
              </span>
            ))}
            <p className="w-full text-[12px] font-sans mt-1" style={{ color: '#a09d99' }}>
              {prep} rausstellen · Abfuhr {collection}
            </p>
          </div>
          {daysLabel && (
            <p className="text-[13px] font-sans flex-shrink-0" style={{ color: '#a09d99' }}>{daysLabel}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Aktiv ───────────────────────────────────────────────────────────────────
  const binSize: 'sm' | 'md' = events.length > 2 ? 'sm' : 'md';
  const titleSize = events.length > 2 ? 17 : events.length > 1 ? 20 : 26;
  const actionText = isTodayCollection ? 'Wird heute abgeholt' : 'Heute Abend rausstellen';
  const timeText = `Abholung ${isTodayCollection ? 'heute' : 'morgen'} ab 6:00 Uhr`;
  const badgeText = isTodayCollection ? 'Heute' : 'Morgen';
  const badgeBg = isTodayCollection ? '#FCEBEB' : '#EAF3DE';
  const badgeColor = isTodayCollection ? '#791F1F' : '#27500A';

  return (
    <div style={card}>
      {header}
      <div className="flex items-center gap-4">
        <div className="flex gap-2 flex-shrink-0">
          {events.map(e => (
            <BinIllustration key={e.id} type={e.type} size={binSize} />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[13px] font-sans" style={{ color: '#6b6760', margin: 0 }}>
            {actionText}
          </p>
          <p className="font-sans font-medium"
            style={{ fontSize: titleSize, color: '#1a1814', margin: '3px 0', lineHeight: 1.2 }}>
            {binLabels.join(' + ')}
          </p>
          <p className="text-[13px] font-sans flex items-center gap-1" style={{ color: '#a09d99', margin: 0 }}>
            <i className="ti ti-clock" style={{ fontSize: 13 }} aria-hidden="true" /> {timeText}
          </p>
        </div>
        <div className="text-[12px] font-sans font-medium rounded-lg px-3 py-1.5 flex-shrink-0"
          style={{ background: badgeBg, color: badgeColor }}>
          {badgeText}
        </div>
      </div>
    </div>
  );
}