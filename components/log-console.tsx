'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogEntry } from '@/lib/types';

const LEVELS = ['all', 'info', 'warn', 'error', 'success'] as const;

export default function LogConsole({ initial = [] as LogEntry[] }) {
  const [entries, setEntries] = useState<LogEntry[]>(initial);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('all');
  const [scope, setScope] = useState('all');
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource('/api/logs/stream');
      source.addEventListener('open', () => setConnected(true));
      source.addEventListener('snapshot', event => {
        setConnected(true);
        const data = JSON.parse((event as MessageEvent).data) as LogEntry[];
        setEntries(prev => merge(prev, data));
      });
      source.addEventListener('logs', event => {
        const data = JSON.parse((event as MessageEvent).data) as LogEntry[];
        setEntries(prev => merge(prev, data));
      });
      source.addEventListener('error', () => {
        setConnected(false);
        source?.close();
        if (!closed) retry = setTimeout(connect, 3000);
      });
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  useEffect(() => {
    if (paused) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, paused]);

  const scopes = useMemo(() => {
    const set = new Set(entries.map(entry => entry.scope));
    return ['all', ...Array.from(set).sort()];
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter(entry => {
        if (level !== 'all' && entry.level !== level) return false;
        if (scope !== 'all' && entry.scope !== scope) return false;
        return true;
      }),
    [entries, level, scope]
  );

  return (
    <div>
      <div className="row wrap mb" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 4 }}>
          {LEVELS.map(lvl => (
            <button
              key={lvl}
              className={`btn sm ${level === lvl ? 'primary' : 'ghost'}`}
              onClick={() => setLevel(lvl)}
              type="button"
            >
              {lvl}
            </button>
          ))}
        </div>

        <select className="select" style={{ width: 160 }} value={scope} onChange={e => setScope(e.target.value)}>
          {scopes.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'all scopes' : s}</option>
          ))}
        </select>

        <div className="grow" />

        <span className={`pill ${connected ? 'ok' : 'warn'}`}>
          <span className="dot" /> {connected ? 'streaming' : 'reconnecting…'}
        </span>
        <button className="btn sm ghost" onClick={() => setPaused(p => !p)} type="button">
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button className="btn sm ghost" onClick={() => setEntries([])} type="button">Clear</button>
      </div>

      <div className="console">
        <div className="console-bar">
          <span className="pill mute mono" style={{ fontSize: 10.5 }}>{filtered.length} lines</span>
          <span className="faint mono" style={{ fontSize: 11 }}>tail -f /var/log/tiertestbot</span>
        </div>
        <div className="console-body" ref={bodyRef}>
          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: '60px 20px' }}>
              <div className="big">🖥️</div>
              Waiting for log output…
            </div>
          ) : (
            filtered.map(entry => (
              <div className={`log-line ${entry.level}`} key={entry.id}>
                <span className="log-time">{new Date(entry.ts).toLocaleTimeString([], { hour12: false })}</span>
                <span className="log-scope">[{entry.scope}]</span>
                <span className="log-msg">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function merge(previous: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  if (!incoming.length) return previous;
  const seen = new Set(previous.map(entry => entry.id));
  const fresh = incoming.filter(entry => !seen.has(entry.id));
  if (!fresh.length) return previous;
  const next = [...previous, ...fresh];
  return next.length > 800 ? next.slice(next.length - 800) : next;
}
