'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',          icon: 'ti-layout-dashboard', label: 'Dashboard'     },
  { href: '/calendar',  icon: 'ti-calendar',          label: 'Kalender'      },
  { href: '/timetable', icon: 'ti-school',             label: 'Stundenpläne'  },
  { href: '/meals',     icon: 'ti-bowl',               label: 'Essensplan'    },
  { href: '/shopping',  icon: 'ti-shopping-cart',      label: 'Einkaufsliste' },
  { href: '/heating',   icon: 'ti-thermometer',        label: 'Heizung'       },
  { href: '/weather',   icon: 'ti-cloud',              label: 'Wetter'        },
];
const BOTTOM_NAV = [
  { href: '/members',  icon: 'ti-users',    label: 'Mitglieder'    },
  { href: '/admin',    icon: 'ti-settings', label: 'Einstellungen' },
];

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex items-center justify-center rounded-xl transition-all duration-150"
      style={{
        width: 44, height: 44,
        background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
        color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 22 }} aria-hidden="true" />
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav
      className="flex-shrink-0 flex flex-col items-center gap-1"
      style={{
        width: 64,
        background: '#1e1b18',
        paddingTop: 10,
        paddingBottom: 16,
      }}
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