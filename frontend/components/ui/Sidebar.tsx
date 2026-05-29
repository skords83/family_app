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

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      className="relative group flex items-center justify-center rounded-xl transition-all duration-150"
      style={{
        width: 44, height: 44,
        background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
        color: active ? '#ffffff' : 'rgba(255,255,255,0.4)',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 22 }} aria-hidden="true" />
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute left-[52px] px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans"
        style={{ background: '#1e1b18', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav
      className="flex-shrink-0 flex flex-col items-center py-4 gap-1"
      style={{ width: 64, background: '#1e1b18', minHeight: '100%', height: '100%' }}
    >
      {NAV.map(({ href, icon, label }) => (
        <NavItem key={href} href={href} icon={icon} label={label}
          active={href === '/' ? pathname === '/' : pathname.startsWith(href)} />
      ))}
      <div className="flex-1" />
      {BOTTOM_NAV.map(({ href, icon, label }) => (
        <NavItem key={href} href={href} icon={icon} label={label}
          active={pathname.startsWith(href)} />
      ))}
    </nav>
  );
}