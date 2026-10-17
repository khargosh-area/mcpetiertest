import { getVercelStatus } from '@/lib/vercel';
import { getBotState } from '@/lib/dashboard';
import CopyButton from '@/components/copy-button';
import { IconRocket, IconCheck, IconAlert, IconExternal } from '@/components/icons';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    title: 'Push the code',
    body: 'This repository contains both the Discord bot and the control panel. Push the branch to GitHub.',
    code: `git add -A
git commit -m "feat: control panel + Vercel deployment"
git push origin arena/9e856443-mcpetiertest`
  },
  {
    title: 'Import into Vercel',
    body: 'Create a project from the GitHub repository. The build settings are already in the repo (Next.js + vercel.json) — no manual configuration needed.',
    code: `vercel link
vercel --prod`
  },
  {
    title: 'Add the secrets',
    body: 'DISCORD_TOKEN and CLIENT_ID are required. DASHBOARD_PASSWORD protects the panel. DATABASE_URL makes tiers, queue and logs persistent and shared between the bot and the dashboard.',
    code: `vercel env add DISCORD_TOKEN production
vercel env add CLIENT_ID production
vercel env add DASHBOARD_PASSWORD production
vercel env add DATABASE_URL production`
  },
  {
    title: 'Keep the bot alive',
    body: 'A Discord bot needs a persistent connection. On Vercel the session runs in a background function; a cron re-launches it every few minutes. Add the cron to vercel.json (Vercel Pro allows minute-level crons).',
    code: `{
  "crons": [
    { "path": "/api/bot/keepalive", "schedule": "* * * * *" }
  ]
}`
  },
  {
    title: 'Set the bot up in Discord',
    body: 'Invite the bot with the Manage Roles / Manage Channels permissions, then run /setup in every server you want to manage.',
    code: `/setup`
  }
];

export default async function DeployPage() {
  const [vercel, bot] = await Promise.all([getVercelStatus(), getBotState()]);

  return (
    <main className="page">
      <div className="row between wrap mb" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Deploy</h2>
          <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
            Ship the bot and the control panel to Vercel.
          </p>
        </div>
        <span className={`pill ${vercel.connected ? 'ok' : 'mute'}`}>
          {vercel.connected ? 'Vercel connected' : 'Vercel token not set'}
        </span>
      </div>

      <div className="grid hero mb">
        <div className="card">
          <div className="card-head">
            <IconRocket width={16} height={16} />
            <h2>Deployment status</h2>
            <span className="sub">{vercel.projectName || 'project not linked'}</span>
          </div>
          <div className="card-body">
            {!vercel.connected ? (
              <div className="alert">
                <IconAlert />
                <div>
                  <b>Live deployment status is off.</b> Set <code className="mono">VERCEL_TOKEN</code>,{' '}
                  <code className="mono">VERCEL_PROJECT_ID</code> and (for team accounts){' '}
                  <code className="mono">VERCEL_TEAM_ID</code> to see deployments here.
                  {vercel.error && <div className="faint" style={{ marginTop: 6 }}>{vercel.error}</div>}
                </div>
              </div>
            ) : vercel.deployments.length === 0 ? (
              <div className="empty">No deployments found for this project yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Deployment</th>
                      <th>State</th>
                      <th>Target</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {vercel.deployments.map(deployment => (
                      <tr key={deployment.id}>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {deployment.source || deployment.name}
                        </td>
                        <td>
                          <span className={`pill ${deployment.state === 'READY' ? 'ok' : deployment.state === 'ERROR' ? 'err' : 'warn'}`}>
                            {deployment.state}
                          </span>
                        </td>
                        <td className="faint">{deployment.target}</td>
                        <td className="faint">{new Date(deployment.createdAt).toLocaleString()}</td>
                        <td className="td-actions">
                          {deployment.url && (
                            <a className="btn sm ghost" href={deployment.url} target="_blank" rel="noreferrer">
                              <IconExternal width={13} height={13} /> Open
                            </a>
                          )}
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
            <h2>Current runtime</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Bot</dt>
              <dd>
                <span className={`pill ${bot.online ? 'ok' : 'err'}`}>
                  <span className="dot" /> {bot.online ? 'Online' : 'Offline'}
                </span>
              </dd>
              <dt>Session</dt>
              <dd className="mono">{bot.sessionId || '—'}</dd>
              <dt>Heartbeat</dt>
              <dd className="faint">{bot.lastSeen ? new Date(bot.lastSeen).toLocaleString() : 'never'}</dd>
              <dt>Hosting</dt>
              <dd className="muted">Vercel background function</dd>
            </dl>
            <div className="alert warn mt">
              <IconAlert />
              <div>
                Vercel functions are capped at 300s (Hobby) / 800s (Pro). The bot therefore runs in a session window and
                is restarted by the keepalive cron. For guaranteed 24/7 uptime, also run it on an always-on host with{' '}
                <code className="mono">npm start</code> — both instances share the same database.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb">
        <div className="card-head">
          <h2>Deploy in 5 steps</h2>
          <span className="sub">from this repository to a live URL</span>
        </div>
        <div className="card-body">
          <div className="steps">
            {STEPS.map((step, index) => (
              <div className="step" key={step.title}>
                <div className="step-num">{index + 1}</div>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.body}</p>
                  <div className="code copy" style={{ marginTop: 9 }}>
                    {step.code}
                    <CopyButton value={step.code} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>Keep-alive endpoints</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Start now</dt>
              <dd className="mono">POST /api/bot</dd>
              <dt>Cron target</dt>
              <dd className="mono">GET /api/bot/keepalive</dd>
              <dt>Stop / restart</dt>
              <dd className="mono">POST /api/bot/control</dd>
              <dt>Health check</dt>
              <dd className="mono">GET /api/status</dd>
            </dl>
            <p className="faint mt" style={{ fontSize: 12 }}>
              On a Hobby plan Vercel crons run once per day. For minute-level restarts use a Pro plan, or point an
              external uptime pinger (UptimeRobot, cron-job.org) at <code className="mono">/api/bot/keepalive</code>.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Troubleshooting</h2>
          </div>
          <div className="card-body col" style={{ gap: 10 }}>
            {[
              ['Bot does not log in', 'Check DISCORD_TOKEN and CLIENT_ID are set for the Production environment, then redeploy.'],
              ['Commands missing in Discord', 'They are registered on every bot start — restart the session and wait a few seconds.'],
              ['Roles are not created', 'The bot role must be above the tier roles and have Manage Roles + Manage Channels.'],
              ['Dashboard shows no data', 'The bot and the dashboard must share a database — set DATABASE_URL for both.'],
              ['Session keeps dying', 'Raise maxDuration for app/api/bot/route.ts in vercel.json (Pro allows up to 800s).']
            ].map(([title, fix]) => (
              <div className="row" key={title} style={{ alignItems: 'flex-start', gap: 9 }}>
                <span style={{ color: 'var(--ok)', marginTop: 2 }}><IconCheck width={14} height={14} /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
                  <div className="faint" style={{ fontSize: 12.3 }}>{fix}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
