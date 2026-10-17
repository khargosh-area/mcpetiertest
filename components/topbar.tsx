import type { BotState } from '@/lib/types';
import { IconPulse, IconClock } from './icons';

function formatUptime(ms: number): string {
  if (!ms || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Topbar({ bot }: { bot: BotState }) {
  return (
    <header className="topbar">
      <div>
        <h1>TierTestBot</h1>
        <p>Minecraft PvP tier testing — control panel</p>
      </div>
      <div className="topbar-right">
        <span className="pill mute" title="Gateway latency">
          <IconPulse width={12} height={12} /> {bot.latency ? `${bot.latency}ms` : '—'}
        </span>
        <span className="pill mute" title="Memory usage">
          <IconClock width={12} height={12} /> {bot.memory ? `${bot.memory}MB` : '—'}
        </span>
        <span className="pill mute nowrap" title="Uptime">
          up {formatUptime(bot.uptimeMs)}
        </span>
        <span className={`pill ${bot.online ? 'ok' : 'err'}`}>
          <span className="dot" />
          {bot.online ? 'Bot online' : 'Bot offline'}
        </span>
      </div>
    </header>
  );
}
