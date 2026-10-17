import LogConsole from '@/components/log-console';
import { readLogEntries } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const entries = await readLogEntries(200);

  return (
    <main className="page">
      <div className="row between wrap mb" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Live logs</h2>
          <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
            Everything the bot writes to the shared log buffer, streamed live.
          </p>
        </div>
        <span className="pill violet">{entries.length} buffered</span>
      </div>

      <LogConsole initial={entries} />
    </main>
  );
}
