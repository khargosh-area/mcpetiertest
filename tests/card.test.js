import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTierCard } from '../src/card.js';

describe('tier card generation', () => {
  it('returns a PNG or safe SVG fallback without needing skin service', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline'); };
    try {
      const result = await buildTierCard({ gamertag:'Notch', mode:'Sword', tier:'HT1', tester:{username:'Tester<&'}, previousTier:null, note:'<unsafe & note>', region:'AS', device:'PC', serverName:'Test Server' });
      assert.ok(['png','svg'].includes(result.ext));
      assert.ok(Buffer.isBuffer(result.buffer));
      if (result.ext === 'svg') {
        const svg = result.buffer.toString();
        assert.match(svg, /&lt;unsafe &amp; note&gt;/);
        assert.match(svg, /Minecraft Skin/);
        assert.match(svg, /Made by Khargosh with/);
      } else {
        assert.ok(result.buffer.length > 1000);
      }
    } finally { globalThis.fetch = originalFetch; }
  });
});
