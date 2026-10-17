'use client';

import { useState } from 'react';
import { MODES, TIERS, TIER_COLORS } from '@/src/core/config.js';

export default function CardDesigner() {
  const [gamertag, setGamertag] = useState('Notch');
  const [mode, setMode] = useState(MODES[0]);
  const [tier, setTier] = useState(TIERS[0]);
  const [tester, setTester] = useState('Dashboard');
  const [region, setRegion] = useState('AS');
  const [device, setDevice] = useState('Mobile');
  const [note, setNote] = useState('ggs');
  const [nonce, setNonce] = useState(0);

  const src = `/api/card?gamertag=${encodeURIComponent(gamertag)}&mode=${encodeURIComponent(mode)}&tier=${encodeURIComponent(tier)}&tester=${encodeURIComponent(tester)}&region=${encodeURIComponent(region)}&device=${encodeURIComponent(device)}&note=${encodeURIComponent(note)}&v=${nonce}`;

  return (
    <div className="grid hero">
      <div className="card">
        <div className="card-body" style={{ padding: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Tier card preview"
            style={{ width: '100%', borderRadius: 12, display: 'block', background: '#0b1020' }}
            onError={() => setNonce(n => n + 1)}
          />
        </div>
        <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => setNonce(n => n + 1)} type="button">Regenerate</button>
            <span className="faint" style={{ fontSize: 11.5 }}>
              Rendered with the same code the bot uses for <code className="mono">/tier</code> (sharp → PNG, SVG fallback).
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Card designer</h2>
          <span className="sub">live preview</span>
        </div>
        <div className="card-body col" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="gamertag">Minecraft gamertag</label>
            <input id="gamertag" className="input" value={gamertag} onChange={e => setGamertag(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="cmode">Gamemode</label>
              <select id="cmode" className="select" value={mode} onChange={e => setMode(e.target.value)}>
                {MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ctier">Tier</label>
              <select id="ctier" className="select" value={tier} onChange={e => setTier(e.target.value)}>
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="ctester">Tester</label>
              <input id="ctester" className="input" value={tester} onChange={e => setTester(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cregion">Region</label>
              <input id="cregion" className="input" value={region} onChange={e => setRegion(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cdevice">Device</label>
              <input id="cdevice" className="input" value={device} onChange={e => setDevice(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cnote">Note</label>
            <input id="cnote" className="input" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div className="mode-chips">
            {TIERS.map(t => (
              <span
                key={t}
                className="mode-chip"
                style={{
                  background: t === tier ? TIER_COLORS[t] : undefined,
                  color: t === tier ? '#0a0b12' : undefined,
                  fontWeight: 700
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
