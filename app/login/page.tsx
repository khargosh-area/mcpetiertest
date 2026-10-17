import { redirect } from 'next/navigation';
import { authConfigured, isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in · TierTestBot' };

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  const configured = authConfigured();

  return (
    <main className="login-shell">
      <form className="card login-card" method="post" action="/api/auth/login">
        <div className="login-logo">⚔️</div>
        <h1 style={{ margin: '0 0 4px', fontSize: 21, letterSpacing: '-0.4px' }}>TierTestBot</h1>
        <p className="faint" style={{ margin: '0 0 22px', fontSize: 13 }}>
          Sign in to the control panel.
        </p>

        {configured ? (
          <>
            <div className="field mb">
              <label htmlFor="password">Dashboard password</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••"
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <button className="btn primary" style={{ width: '100%' }} type="submit">
              Unlock panel
            </button>
          </>
        ) : (
          <div className="alert warn">
            <span>⚠️</span>
            <div>
              <b>No password configured.</b> Set <code className="mono">DASHBOARD_PASSWORD</code> (and optionally{' '}
              <code className="mono">SESSION_SECRET</code>) in your Vercel environment variables, then redeploy.
              Until then the panel is open in read-only mode.
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
