'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',          icon: 'ti-layout-dashboard', label: 'Dashboard'     },
  { href: '/calendar',  icon: 'ti-calendar',          label: 'Kalender'      },
  { href: '/tasks',     icon: 'ti-checkbox',           label: 'Aufgaben'      },
  { href: '/timetable', icon: 'ti-school',             label: 'Stundenpläne'  },
  { href: '/meals',     icon: 'ti-bowl',               label: 'Essensplan'    },
  { href: '/shopping',  icon: 'ti-shopping-cart',      label: 'Einkaufsliste' },
  { href: '/photos',    icon: 'ti-photo',              label: 'Fotos'         },
];

const BOTTOM_NAV = [
  { href: '/members',  icon: 'ti-users',    label: 'Mitglieder'    },
  { href: '/admin',    icon: 'ti-settings', label: 'Einstellungen' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
<nav
        className="w-[60px] flex-shrink-0 flex flex-col items-center py-4 gap-1"
        style={{ background: '#1e1b18', height: '100%' }}
      >
        {NAV.map(({ href, icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="relative group w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-all duration-150"
              style={{
                background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.38)',
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 21 }} aria-hidden="true" />
              <span className="pointer-events-none absolute left-[52px] bg-[#1e1b18] text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg font-sans">
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
              className="relative group w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-all duration-150"
              style={{
                background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.38)',
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 21 }} aria-hidden="true" />
              <span className="pointer-events-none absolute left-[52px] bg-[#1e1b18] text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg font-sans">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
  );
}