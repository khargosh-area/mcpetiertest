import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuildDetail } from '@/lib/dashboard';
import { tierAccent } from '@/src/core/config.js';
import AssignTierForm from '@/components/assign-tier-form';
import ApplicationActions from '@/components/application-actions';
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

export default async function GuildDetailPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const detail = await getGuildDetail(guildId);
  if (!detail) notFound();

  const { guild, leaderboards, recent, applications, queue, modeTotals } = detail;
  const totalResults = modeTotals.reduce((sum, m) => sum + m.total, 0);

  return (
    <main className="page">
      <div className="row between wrap mb" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 13 }}>
          <div className="avatar lg" style={{ width: 52, height: 52, borderRadius: 15, fontSize: 19 }}>
            {guild.icon ? <img src={guild.icon} alt="" /> : (guild.name || '??').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>{guild.name || guildId}</h2>
              <span className="pill mute"><IconUsers width={12} height={12} /> {guild.memberCount?.toLocaleString() ?? '—'}</span>
              <span className="pill violet"><IconTrophy width={12} height={12} /> {totalResults} results</span>
            </div>
            <p className="faint mono" style={{ margin: '2px 0 0', fontSize: 11.5 }}>{guild.id}</p>
          </div>
        </div>
        <Link className="btn ghost" href="/guilds">← All guilds</Link>
      </div>

      <div className="grid cols-3 mb">
        <div className="card stat">
          <span className="stat-label">Modes configured</span>
          <span className="stat-value">{Object.keys(guild.roles || {}).length}</span>
          <span className="stat-hint">{Object.values(guild.roles || {}).reduce((sum, m) => sum + Object.keys(m || {}).length, 0)} tier roles</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Queue</span>
          <span className="stat-value">{queue.length}</span>
          <span className="stat-hint">players waiting for a test</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Applications</span>
          <span className="stat-value">{applications.length}</span>
          <span className="stat-hint">{applications.filter(a => !a.status || a.status === 'pending').length} pending review</span>
        </div>
      </div>

      <div className="card mb">
        <div className="card-head">
          <h2>Assign a tier</h2>
          <span className="sub">the bot applies the role and posts the result</span>
        </div>
        <div className="card-body">
          <AssignTierForm guildId={guildId} />
        </div>
      </div>

      <div className="grid hero mb">
        <div className="card">
          <div className="card-head">
            <h2>Leaderboards</h2>
            <span className="sub">per gamemode</span>
          </div>
          <div className="card-body tight">
            {leaderboards.length === 0 ? (
              <div className="empty">
                <div className="big">🏆</div>
                No results for this server yet.
              </div>
            ) : (
              <div className="col" style={{ gap: 18 }}>
                {leaderboards.map(board => (
                  <div key={board.mode}>
                    <div className="row between" style={{ marginBottom: 7 }}>
                      <strong style={{ fontSize: 13 }}>{board.icon} {board.mode}</strong>
                      <span className="faint" style={{ fontSize: 11.5 }}>{board.rows.length} ranked</span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 42 }}>#</th>
                            <th>Player</th>
                            <th>Tier</th>
                            <th>Note</th>
                            <th>Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {board.rows.slice(0, 10).map((row, index) => (
                            <tr key={`${row.userId}-${row.mode}`}>
                              <td className="tier-rank">#{index + 1}</td>
                              <td>
                                <span className="mono" style={{ fontSize: 12.5 }}>{row.userId}</span>
                                {row.gamertag && <span className="faint"> · {row.gamertag}</span>}
                              </td>
                              <td><span className="tier" style={{ background: tierAccent(row.tier) }}>{row.tier}</span></td>
                              <td className="faint">{row.note || '—'}</td>
                              <td className="faint">{timeAgo(row.updatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-head">
              <h2>Applications</h2>
              <span className="sub">from the apply channel</span>
            </div>
            <div className="card-body tight">
              {applications.length === 0 ? (
                <div className="empty">No applications yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {applications.slice(0, 12).map(application => (
                        <tr key={application.id}>
                          <td>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{application.gamertag}</div>
                            <div className="faint" style={{ fontSize: 11 }}>
                              {application.mode} · {timeAgo(application.createdAt)}
                            </div>
                          </td>
                          <td className="td-actions">
                            <ApplicationActions
                              guildId={guildId}
                              applicationId={application.id}
                              status={application.status}
                            />
                          </td>
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
              <h2>Testing queue</h2>
              <span className="sub">{queue.length} waiting</span>
            </div>
            <div className="card-body tight">
              {queue.length === 0 ? (
                <div className="empty">Queue is empty.</div>
              ) : (
                queue.map((userId, index) => (
                  <div className="row between" key={userId} style={{ padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span className="mono" style={{ fontSize: 12.5 }}><span className="tier-rank">#{index + 1}.</span> {userId}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent results</h2>
          <span className="sub">newest first</span>
        </div>
        <div className="card-body tight">
          {recent.length === 0 ? (
            <div className="empty">
              <div className="big"><IconServer width={30} height={30} /></div>
              Nothing recorded for this server yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Gamemode</th>
                    <th>Tier</th>
                    <th>Region / device</th>
                    <th>Tester</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row, index) => (
                    <tr key={`${row.userId}-${row.mode}-${index}`}>
                      <td>
                        <span className="mono" style={{ fontSize: 12.5 }}>{row.userId}</span>
                        {row.gamertag && <span className="faint"> · {row.gamertag}</span>}
                      </td>
                      <td>{row.mode}</td>
                      <td><span className="tier" style={{ background: tierAccent(row.tier) }}>{row.tier}</span></td>
                      <td className="faint">{row.region || '—'} / {row.device || '—'}</td>
                      <td className="faint mono">{row.tester || '—'}</td>
                      <td className="faint">{timeAgo(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
