'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlay, IconStop, IconRefresh } from './icons';

export default function BotControls({ online }: { online: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function call(url: string, body?: unknown) {
    setBusy(url);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setMessage({ tone: 'err', text: json.error || json.message || `Request failed (${res.status})` });
      } else {
        setMessage({ tone: 'ok', text: json.message || 'Done' });
      }
      router.refresh();
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Network error' });
    } finally {
      setBusy(null);
      setTimeout(() => setMessage(null), 6000);
    }
  }

  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {message && (
        <span className={`pill ${message.tone === 'ok' ? 'ok' : 'err'}`}>{message.text}</span>
      )}
      <button
        className="btn primary"
        disabled={busy !== null || online}
        onClick={() => call('/api/bot')}
        title={online ? 'The bot is already online' : 'Start a bot session on this deployment'}
      >
        <IconPlay /> {online ? 'Running' : 'Start bot'}
      </button>
      <button
        className="btn"
        disabled={busy !== null || !online}
        onClick={() => call('/api/bot/control', { action: 'restart' })}
        title="Ask the running bot to restart its session"
      >
        <IconRefresh /> Restart
      </button>
      <button
        className="btn danger"
        disabled={busy !== null || !online}
        onClick={() => call('/api/bot/control', { action: 'stop' })}
      >
        <IconStop /> Stop
      </button>
    </div>
  );
}
