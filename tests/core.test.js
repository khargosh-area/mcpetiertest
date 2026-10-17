import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateGamertag, validateMode, validateTier, sanitizeNote } from '../src/validation.js';
import { aestheticTier, aestheticMode, tierOrder, MODES, TIERS, escapeXml } from '../src/constants.js';

describe('gamertag validation', () => {
  it('accepts valid tags', () => {
    assert.equal(validateGamertag('Notch').valid, true);
    assert.equal(validateGamertag('Dream_123').valid, true);
    assert.equal(validateGamertag('A_1b').valid, true); // 4 chars ok
    assert.equal(validateGamertag('abc').valid, true);
  });
  it('rejects invalid', () => {
    assert.equal(validateGamertag('ab').valid, false);
    assert.equal(validateGamertag('this_name_is_way_too_long').valid, false);
    assert.equal(validateGamertag('bad-name!').valid, false);
    assert.equal(validateGamertag('').valid, false);
  });
});

describe('tier order', () => {
  it('HT1 is highest', () => {
    assert.ok(tierOrder('HT1') < tierOrder('LT1'));
    assert.ok(tierOrder('HT1') < tierOrder('HT5'));
    assert.ok(tierOrder('LT5') > tierOrder('HT5'));
  });
  it('unknown is last', () => {
    assert.equal(tierOrder('UNKNOWN'), 999);
  });
});

describe('aesthetic', () => {
  it('formats tier', () => {
    assert.equal(aestheticTier('HT1'), 'ʜᴛ¹');
    assert.equal(aestheticTier('LT5'), 'ʟᴛ⁵');
    assert.equal(aestheticTier('LT3'), 'ʟᴛ³');
  });
  it('formats mode', () => {
    assert.ok(aestheticMode('Sword').length > 0);
    // NethPot aesthetic should be distinct from plain
    const neth = aestheticMode('NethPot');
    assert.ok(neth.length > 0);
    assert.notEqual(neth, 'nethpot');
  });
});

describe('mode validation', () => {
  it('accepts known modes', () => {
    for (const m of MODES) assert.equal(validateMode(m).valid, true);
  });
  it('rejects unknown', () => {
    assert.equal(validateMode('FakeMode').valid, false);
  });
});

describe('tier validation', () => {
  it('accepts tiers', () => {
    for (const t of TIERS) assert.equal(validateTier(t).valid, true);
  });
});

describe('sanitize', () => {
  it('limits note', () => {
    assert.equal(sanitizeNote('a'.repeat(300)).length, 200);
    assert.equal(sanitizeNote(''), 'ggs');
  });
  it('escapes xml', () => {
    assert.equal(escapeXml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
});

describe('constants completeness', () => {
  it('has 10 modes', () => assert.equal(MODES.length, 10));
  it('has 10 tiers', () => assert.equal(TIERS.length, 10));
});
