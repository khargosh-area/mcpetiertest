import Link from 'next/link';
import { getOverview } from '@/lib/dashboard';
import { MODE_ICONS, TIER_COLORS, tierRank } from '@/src/core/config.js';
import { tierAccent } from '@/src/core/config.js';
import BotControls from '@/components/bot-controls';
import { IconServer, IconUsers, IconTrophy, IconLayers } from '@/components/icons';
import type { LogEntry } from '@/lib/types';

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

function formatUptime(ms: number): string {
  if (!ms) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${total % 60}s`;
}

export default async function OverviewPage() {
  const data = await getOverview();
  const { bot, storage, stats, activity, modeStats, leaderboard, tierSpread, actions } = data;
  const maxMode = Math.max(1, ...modeStats.map(m => m.total));

  return (
    <main className="page">
      <div className="row between wrap mb" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Overview</h2>
          <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
            Live state of the bot, your servers and the shared database.
          </p>
        </div>
        <BotControls online={bot.online} />
      </div>

      {!bot.online && (
        <div className="alert warn mb">
          <span>⚠️</span>
          <div>
            <b>The bot is offline.</b>{' '}
            {bot.lastSeen
              ? `Last heartbeat was ${timeAgo(bot.lastSeen)}.`
              : 'No heartbeat has been recorded yet.'}{' '}
            Start a session from the button above, or run <code className="mono">npm start</code> on an always-on host.
          </div>
        </div>
      )}

      {storage.ephemeral && (
        <div className="alert warn mb">
          <span>⚠️</span>
          <div>
            <b>Ephemeral storage detected.</b> No <code className="mono">DATABASE_URL</code> is configured, so data is
            written to a temporary directory and is lost when the instance restarts. Add a Postgres connection string to
            persist tiers, queues and logs — see <Link href="/settings" style={{ textDecoration: 'underline' }}>Settings</Link>.
          </div>
        </div>
      )}

      <div className="grid cols-4 mb">
        <div className="card stat">
          <div className="stat-icon"><IconServer /></div>
          <span className="stat-label">Guilds</span>
          <span className="stat-value">{stats.guilds}</span>
          <span className="stat-hint">{stats.modesConfigured} configured with tier roles</span>
        </div>
        <div className="card stat">
          <div className="stat-icon"><IconUsers /></div>
          <span className="stat-label">Ranked players</span>
          <span className="stat-value">{stats.players}</span>
          <span className="stat-hint">{stats.results} total tier results</span>
        </div>
        <div className="card stat">
          <div className="stat-icon"><IconTrophy /></div>
          <span className="stat-label">Applications</span>
          <span className="stat-value">{stats.applications}</span>
          <span className="stat-hint">{stats.pendingApplications} waiting for review</span>
        </div>
        <div className="card stat">
          <div className="stat-icon"><IconLayers /></div>
          <span className="stat-label">Storage</span>
          <span className="stat-value" style={{ fontSize: 20, paddingTop: 4 }}>{storage.kind}</span>
          <span className="stat-hint">{storage.ephemeral ? 'ephemeral — not persisted' : 'persisted & shared'}</span>
        </div>
      </div>

      <div className="grid hero mb">
        <div className="card">
          <div className="card-head">
            <h2>Tier distribution</h2>
            <span className="sub">across every configured gamemode</span>
          </div>
          <div className="card-body">
            {tierSpread.every(t => t.count === 0) ? (
              <div className="empty">
                <div className="big">📊</div>
                No tier results recorded yet — run <code className="mono">/tier</code> in Discord to populate this chart.
              </div>
            ) : (
              <div className="bars">
                {tierSpread.map(tier => {
                  const max = Math.max(1, ...tierSpread.map(t => t.count));
                  return (
                    <div className="bar-row" key={tier.tier}>
                      <span>
                        <span className="tier" style={{ background: tier.color }}>{tier.tier}</span>
                      </span>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: `${(tier.count / max) * 100}%`, background: tier.color }} />
                      </span>
                      <span className="bar-val">{tier.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Runtime</h2>
            <span className="sub">current session</span>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Status</dt>
              <dd>
                <span className={`pill ${bot.online ? 'ok' : 'err'}`}>
                  <span className="dot" /> {bot.online ? 'Online' : 'Offline'}
                </span>
              </dd>
              <dt>Version</dt>
              <dd className="mono">{bot.version}</dd>
              <dt>Uptime</dt>
              <dd className="mono">{formatUptime(bot.uptimeMs)}</dd>
              <dt>Gateway ping</dt>
              <dd className="mono">{bot.latency ? `${bot.latency} ms` : '—'}</dd>
              <dt>Memory</dt>
              <dd className="mono">{bot.memory ? `${bot.memory} MB` : '—'}</dd>
              <dt>Session</dt>
              <dd className="mono faint">{bot.sessionId || '—'}</dd>
              <dt>Last heartbeat</dt>
              <dd className="faint">{timeAgo(bot.lastSeen)}</dd>
              <dt>Storage</dt>
              <dd className="mono">{storage.kind}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid hero mb">
        <div className="card">
          <div className="card-head">
            <h2>Global leaderboard</h2>
            <span className="sub">best tiers first</span>
          </div>
          <div className="card-body tight">
            {leaderboard.length === 0 ? (
              <div className="empty">
                <div className="big">🏆</div>
                No ranked players yet.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 46 }}>#</th>
                      <th>Player</th>
                      <th>Gamemode</th>
                      <th>Tier</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, index) => (
                      <tr key={`${row.guildId}-${row.userId}-${row.mode}`}>
                        <td className="tier-rank">#{index + 1}</td>
                        <td>
                          <span className="mono" style={{ fontSize: 12.5 }}>{row.userId}</span>
                          {row.gamertag && <span className="faint"> · {row.gamertag}</span>}
                        </td>
                        <td>{MODE_ICONS[row.mode] || '🎮'} {row.mode}</td>
                        <td><span className="tier" style={{ background: tierAccent(row.tier) }}>{row.tier}</span></td>
                        <td className="faint">{timeAgo(row.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Activity</h2>
            <span className="sub">latest bot events</span>
            <Link href="/logs" className="btn sm ghost" style={{ marginLeft: 'auto' }}>View all</Link>
          </div>
          <div className="card-body tight">
            {activity.length === 0 ? (
              <div className="empty">
                <div className="big">📭</div>
                No log entries yet.
              </div>
            ) : (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {activity.slice(0, 18).map((entry: LogEntry) => (
                  <div key={entry.id} className={`log-line ${entry.level}`}>
                    <span className="log-time">{new Date(entry.ts).toLocaleTimeString([], { hour12: false })}</span>
                    <span className="log-scope">{entry.scope}</span>
                    <span className="log-msg">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb">
        <div className="card-head">
          <h2>Gamemode coverage</h2>
          <span className="sub">tier results per mode</span>
        </div>
        <div className="card-body">
          <div className="bars">
            {modeStats.map(entry => (
              <div className="bar-row" key={entry.mode}>
                <span>{entry.icon} {entry.mode}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(entry.total / maxMode) * 100}%` }} />
                </span>
                <span className="bar-val">{entry.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Dashboard actions</h2>
            <span className="sub">queued for the bot</span>
          </div>
          <div className="card-body tight">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Guild</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map(action => (
                    <tr key={action.id}>
                      <td className="mono">{action.type}</td>
                      <td className="mono faint">{action.guildId || '—'}</td>
                      <td>
                        <span className={`pill ${action.status === 'done' ? 'ok' : action.status === 'error' ? 'err' : action.status === 'running' ? 'info' : 'warn'}`}>
                          {action.status}
                        </span>
                      </td>
                      <td className="faint">{timeAgo(action.createdAt)}</td>
                      <td className="faint">{action.result?.message || action.result?.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
