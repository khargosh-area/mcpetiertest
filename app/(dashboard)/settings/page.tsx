import { getStorageState } from '@/lib/dashboard';
import { authConfigured } from '@/lib/auth';
import { IconCheck, IconAlert, IconDatabase, IconSettings } from '@/components/icons';
import CopyButton from '@/components/copy-button';

export const dynamic = 'force-dynamic';

const ENV = [
  { key: 'DISCORD_TOKEN', label: 'Discord bot token', required: true, hint: 'Developer Portal → Bot → Reset Token' },
  { key: 'CLIENT_ID', label: 'Discord application ID', required: true, hint: 'Developer Portal → General Information' },
  { key: 'DASHBOARD_PASSWORD', label: 'Dashboard password', required: false, hint: 'Unlocks the control panel' },
  { key: 'SESSION_SECRET', label: 'Session signing secret', required: false, hint: 'openssl rand -hex 32' },
  { key: 'DATABASE_URL', label: 'Postgres connection string', required: false, hint: 'Neon / Supabase / Vercel Postgres' },
  { key: 'VERCEL_TOKEN', label: 'Vercel API token', required: false, hint: 'Enables live deployment status' },
  { key: 'VERCEL_PROJECT_ID', label: 'Vercel project ID', required: false, hint: 'Found in project settings' },
  { key: 'VERCEL_TEAM_ID', label: 'Vercel team ID', required: false, hint: 'Optional — scope for team accounts' }
];

export default async function SettingsPage() {
  const storage = await getStorageState();
  const authed = authConfigured();

  return (
    <main className="page">
      <div className="mb" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Settings</h2>
        <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
          Storage backend, environment checklist and panel security.
        </p>
      </div>

      <div className="grid hero mb">
        <div className="card">
          <div className="card-head">
            <IconDatabase width={16} height={16} />
            <h2>Storage backend</h2>
            <span className="sub">where tiers, queue and logs live</span>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Adapter</dt>
              <dd className="mono">{storage.kind}</dd>
              <dt>Location</dt>
              <dd className="mono" style={{ wordBreak: 'break-all' }}>{storage.location}</dd>
              <dt>Durability</dt>
              <dd>
                <span className={`pill ${storage.ephemeral ? 'warn' : 'ok'}`}>
                  {storage.ephemeral ? 'ephemeral' : 'persistent'}
                </span>
              </dd>
            </dl>

            {storage.ephemeral && (
              <div className="alert warn mt">
                <IconAlert />
                <div>
                  <b>Nothing is persisted.</b> Without a database the bot writes to a temporary directory that is wiped
                  when the instance restarts. Add a Postgres connection string to make tiers, the queue and the log
                  history survive restarts — and to let the bot and the dashboard share state.
                </div>
              </div>
            )}

            <div className="mt">
              <div className="faint" style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                Connect a database
              </div>
              <div className="code copy">
{`# 1. Create a free Neon database (or use Supabase / Vercel Postgres)
# 2. Copy the pooled connection string
# 3. Add it to your Vercel project, then redeploy
vercel env add DATABASE_URL production`}
                <CopyButton value={'vercel env add DATABASE_URL production'} label="Copy" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <IconSettings width={16} height={16} />
            <h2>Panel security</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Password</dt>
              <dd>
                <span className={`pill ${authed ? 'ok' : 'warn'}`}>
                  {authed ? 'configured' : 'not set — panel is open'}
                </span>
              </dd>
              <dt>Session</dt>
              <dd className="muted">HttpOnly, SameSite=Lax cookie · 7 day lifetime</dd>
              <dt>Secret</dt>
              <dd className="muted">
                {process.env.SESSION_SECRET ? 'SESSION_SECRET set' : 'derived from DASHBOARD_PASSWORD'}
              </dd>
            </dl>
            <div className="alert mt">
              <IconAlert />
              <div>
                Set <code className="mono">DASHBOARD_PASSWORD</code> before exposing the panel publicly. Without it the
                dashboard is read-only and open to anyone with the URL.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Environment variables</h2>
          <span className="sub">values are never displayed</span>
        </div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Purpose</th>
                  <th>Required</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ENV.map(item => {
                  const present = Boolean(process.env[item.key]?.trim());
                  return (
                    <tr key={item.key}>
                      <td className="mono">{item.key}</td>
                      <td className="muted">
                        {item.label}
                        {item.hint && <span className="faint" style={{ display: 'block', fontSize: 11 }}>{item.hint}</span>}
                      </td>
                      <td>{item.required ? <span className="pill err">required</span> : <span className="pill mute">optional</span>}</td>
                      <td>
                        <span className={`pill ${present ? 'ok' : item.required ? 'err' : 'mute'}`}>
                          {present ? <><IconCheck width={11} height={11} /> set</> : 'missing'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
