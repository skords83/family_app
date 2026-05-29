'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',           icon: '⊞',  label: 'Dashboard'       },
  { href: '/calendar',   icon: '📅',  label: 'Kalender'        },
  { href: '/tasks',      icon: '✅',  label: 'Aufgaben'        },
  { href: '/timetable',  icon: '🎓',  label: 'Stundenpläne'    },
  { href: '/meals',      icon: '🍽️',  label: 'Essensplan'      },
  { href: '/shopping',   icon: '🛒',  label: 'Einkaufsliste'   },
  { href: '/photos',     icon: '🖼️',  label: 'Fotos'           },
];

const BOTTOM_NAV = [
  { href: '/members',    icon: '👥',  label: 'Mitglieder'      },
  { href: '/admin',      icon: '⚙️',  label: 'Einstellungen'   },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="w-[60px] flex-shrink-0 flex flex-col items-center py-4 gap-1"
      style={{ background: '#1e1b18', height: '100%' }}
    >
      {NAV.map(({ href, icon, label }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className="relative group w-[44px] h-[44px] rounded-xl flex items-center justify-center text-xl transition-all duration-150"
            style={{
              background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.38)',
            }}
          >
            <span>{icon}</span>
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-[52px] bg-[#1e1b18] text-white text-xs font-[system-ui] px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              {label}
            </span>
          </Link>
        );
      })}

      <div className="flex-1" />

      {BOTTOM_NAV.map(({ href, icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className="relative group w-[44px] h-[44px] rounded-xl flex items-center justify-center text-xl transition-all duration-150"
            style={{
              background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.38)',
            }}
          >
            <span>{icon}</span>
            <span className="pointer-events-none absolute left-[52px] bg-[#1e1b18] text-white text-xs font-[system-ui] px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}