import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '../src/commands.js';

describe('slash command registration payload', () => {
  it('contains every implemented command', () => {
    const names = commands.map(c=>c.name).sort();
    for (const name of ['setup','register','test','tier','profile','history','leaderboard','modes','queue']) assert.ok(names.includes(name), `missing /${name}`);
    assert.equal(new Set(names).size, names.length, 'command names must be unique');
  });
  it('has legal Discord command lengths and required options', () => {
    for (const command of commands) {
      assert.ok(command.name.length <= 32);
      assert.ok(command.description.length <= 100);
    }
    const tier = commands.find(c=>c.name==='tier');
    assert.ok(tier.options.some(o=>o.name==='tester' && o.type===6));
    assert.ok(tier.options.some(o=>o.name==='player' && o.required));
  });
});
