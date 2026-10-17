'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconGauge, IconServer, IconTerminal, IconCommand, IconSettings,
  IconRocket, IconLogout, IconDatabase, IconLayers
} from './icons';
import type { BotState, StorageState } from '@/lib/types';

const MONITOR_NAV = [
  { href: '/', label: 'Overview', icon: IconGauge },
  { href: '/guilds', label: 'Guilds', icon: IconServer },
  { href: '/logs', label: 'Live logs', icon: IconTerminal },
  { href: '/card', label: 'Tier card', icon: IconLayers }
];

const MANAGE_NAV = [
  { href: '/commands', label: 'Commands', icon: IconCommand },
  { href: '/deploy', label: 'Deploy', icon: IconRocket },
  { href: '/settings', label: 'Settings', icon: IconSettings }
];

export default function Sidebar({ bot, storage }: { bot: BotState; storage: StorageState }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">⚔️</div>
        <div className="brand-text">
          <div className="brand-name">TierTestBot</div>
          <div className="brand-sub">Control Panel</div>
        </div>
      </div>

      <div className="nav-label">Monitor</div>
      {MONITOR_NAV.map(item => (
        <Link key={item.href} href={item.href} className={`nav-item${isActive(item.href) ? ' active' : ''}`}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      ))}

      <div className="nav-label">Manage</div>
      {MANAGE_NAV.map(item => (
        <Link key={item.href} href={item.href} className={`nav-item${isActive(item.href) ? ' active' : ''}`}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      ))}

      <div className="sidebar-foot">
        <div className="card" style={{ padding: '11px 12px' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="faint" style={{ fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: 600 }}>
              Storage
            </span>
            <span className="pill mute" style={{ fontSize: 10.5 }}>
              <IconDatabase width={11} height={11} /> {storage.kind}
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className={`pill ${bot.online ? 'ok' : 'err'}`}>
              <span className="dot" /> {bot.online ? 'Online' : 'Offline'}
            </span>
            <span className="faint" style={{ fontSize: 11 }}>v{bot.version}</span>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="nav-item" style={{ width: '100%', background: 'none', cursor: 'pointer' }} type="submit">
            <IconLogout />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
