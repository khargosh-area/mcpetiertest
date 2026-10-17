'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck, IconX } from './icons';

export default function ApplicationActions({
  guildId,
  applicationId,
  status
}: {
  guildId: string;
  applicationId: string;
  status?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(type: 'approveApplication' | 'rejectApplication') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guildId, payload: { applicationId } })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) setError(json.error || 'Action failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  if (status && status !== 'pending') {
    return <span className={`pill ${status === 'approved' ? 'ok' : 'mute'}`}>{status}</span>;
  }

  return (
    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
      {error && <span className="pill err">{error}</span>}
      <button className="btn sm" disabled={busy} onClick={() => act('approveApplication')}>
        <IconCheck width={13} height={13} /> Approve
      </button>
      <button className="btn sm danger" disabled={busy} onClick={() => act('rejectApplication')}>
        <IconX width={13} height={13} /> Reject
      </button>
    </div>
  );
}
