'use client';

import { useClientDateStr } from '@/hooks/useClientDate';

interface BirthdayToday {
  name: string;
  age: number | null;
}

interface BirthdayUpcoming {
  name: string;
  age: number | null;
  daysUntil: number;
}

interface BirthdaysData {
  today: BirthdayToday | null;
  upcoming: BirthdayUpcoming[];
  fetched_at: string;
}

interface BirthdayWidgetProps {
  data?: BirthdaysData;
  loading?: boolean;
}

const MAX_UPCOMING_SHOWN = 2;

function weekdayShort(daysUntil: number, todayStr: string): string {
  const target = new Date(todayStr + 'T00:00:00');
  target.setDate(target.getDate() + daysUntil);
  return target.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
}

function ageLabel(name: string, age: number | null): string {
  return age != null ? `${name} wird ${age}` : `${name} hat Geburtstag`;
}

export default function BirthdayWidget({ data, loading }: BirthdayWidgetProps) {
  const todayStr = useClientDateStr();

  const card = {
    background: 'var(--family-surface)',
    border: '0.5px solid var(--family-border)',
    borderRadius: 16,
    padding: 16,
  };

  if (loading) {
    return (
      <div style={{ ...card, height: 64 }} className="animate-pulse">
        <div style={{ background: '#e8e4de', borderRadius: 4, height: 14, width: '60%' }} />
      </div>
    );
  }

  // Kein Geburtstag heute oder diese Woche -> kein Wrapper, keine Hoehe.
  // Kritisch wegen overflow:hidden im Dashboard-Grid (frontend/app/page.tsx).
  if (!data || (!data.today && data.upcoming.length === 0)) {
    return null;
  }

  // Client-Datum noch nicht hydriert -> Platzhalter, um Layout-Sprung zu vermeiden.
  if (!todayStr) {
    return <div style={{ height: 64 }} />;
  }

  const shownUpcoming = data.upcoming.slice(0, MAX_UPCOMING_SHOWN);
  const extraCount = data.upcoming.length - shownUpcoming.length;

  const upcomingLine = shownUpcoming
    .map(e => `${ageLabel(e.name, e.age)} · ${weekdayShort(e.daysUntil, todayStr)}`)
    .join(' · ');

  return (
    <div style={card}>
      {data.today && (
        <div className="flex items-center gap-2">
          <i className="ti ti-gift" style={{ fontSize: 20, color: '#ec4899' }} aria-hidden="true" />
          <p className="font-sans font-medium" style={{ fontSize: 16, color: '#1a1814', margin: 0 }}>
            Heute: {ageLabel(data.today.name, data.today.age)}
          </p>
        </div>
      )}
      {data.upcoming.length > 0 && (
        <p
          className="text-[12px] font-sans truncate"
          style={{ color: '#a09d99', margin: data.today ? '4px 0 0' : 0 }}
        >
          {upcomingLine}
          {extraCount > 0 ? ` · +${extraCount} weitere` : ''}
        </p>
      )}
    </div>
  );
}
