import Link from 'next/link';
import { getGuildSummaries } from '@/lib/dashboard';
import { IconServer, IconUsers, IconTrophy } from '@/components/icons';

export const dynamic = 'force-dynamic';

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return 'never';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function GuildsPage() {
  const guilds = await getGuildSummaries();

  return (
    <main className="page">
      <div className="row between wrap mb" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Guilds</h2>
          <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
            Every server the bot has been set up in, with its tier data.
          </p>
        </div>
        <span className="pill violet">{guilds.length} server{guilds.length === 1 ? '' : 's'}</span>
      </div>

      {guilds.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="big"><IconServer width={34} height={34} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>No guilds yet</div>
            <p style={{ maxWidth: 420, margin: '6px auto 0' }}>
              Invite the bot to your server and run <code className="mono">/setup</code> — the server will appear here
              with its leaderboards, queue and applications.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid cols-2">
          {guilds.map(guild => (
            <div className="card" key={guild.id}>
              <div className="card-body">
                <div className="row" style={{ gap: 12 }}>
                  <div className="avatar lg">
                    {guild.icon ? <img src={guild.icon} alt="" /> : guild.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 15 }}>{guild.name}</div>
                    <div className="faint mono" style={{ fontSize: 11.5 }}>{guild.id}</div>
                  </div>
                  <Link className="btn sm" href={`/guilds/${guild.id}`}>Open</Link>
                </div>

                <div className="row wrap mt" style={{ gap: 8 }}>
                  <span className="pill mute"><IconUsers width={12} height={12} /> {guild.memberCount?.toLocaleString() ?? '—'} members</span>
                  <span className="pill mute"><IconTrophy width={12} height={12} /> {guild.results} results</span>
                  <span className="pill mute">{guild.modes.length} modes</span>
                  {guild.pendingApplications > 0 && <span className="pill warn">{guild.pendingApplications} pending</span>}
                  {guild.queueLength > 0 && <span className="pill info">{guild.queueLength} in queue</span>}
                </div>

                <div className="mode-chips mt">
                  {guild.modes.slice(0, 10).map(mode => (
                    <span className="mode-chip" key={mode}>{mode}</span>
                  ))}
                  {guild.modes.length === 0 && <span className="faint" style={{ fontSize: 12 }}>Not set up — run /setup in this server</span>}
                </div>

                <div className="row between mt faint" style={{ fontSize: 11.5 }}>
                  <span>Last activity {timeAgo(guild.lastActivity)}</span>
                  <span>Synced {timeAgo(guild.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
