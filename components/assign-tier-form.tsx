'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MODES, TIERS } from '@/src/core/config.js';
import { IconCheck, IconX } from './icons';

export default function AssignTierForm({ guildId }: { guildId: string }) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [mode, setMode] = useState(MODES[0]);
  const [tier, setTier] = useState(TIERS[0]);
  const [gamertag, setGamertag] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'assignTier',
          guildId,
          payload: { userId: userId.trim(), mode, tier, gamertag: gamertag.trim() || undefined, note: note.trim() || undefined }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setMessage({ tone: 'err', text: json.error || 'Could not queue the action.' });
      } else {
        setMessage({ tone: 'ok', text: 'Queued — the bot applies it within a few seconds.' });
        setUserId('');
        setGamertag('');
        setNote('');
        router.refresh();
      }
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Network error' });
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 7000);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="userId">Discord user ID</label>
          <input
            id="userId"
            className="input mono"
            placeholder="123456789012345678"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="mode">Gamemode</label>
          <select id="mode" className="select" value={mode} onChange={e => setMode(e.target.value)}>
            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tier">Tier</label>
          <select id="tier" className="select" value={tier} onChange={e => setTier(e.target.value)}>
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row mt">
        <div className="field">
          <label htmlFor="gamertag">Minecraft gamertag</label>
          <input id="gamertag" className="input" placeholder="Notch" value={gamertag} onChange={e => setGamertag(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="note">Note</label>
          <input id="note" className="input" placeholder="ggs" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="field" style={{ justifySelf: 'start' }}>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Queuing…' : 'Assign tier'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.tone === 'ok' ? 'ok' : 'err'} mt`}>
          {message.tone === 'ok' ? <IconCheck /> : <IconX />}
          <div>{message.text}</div>
        </div>
      )}
    </form>
  );
}
