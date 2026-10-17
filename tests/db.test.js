import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { initDB, readDB, withDB, verifyAccess, getRegistration } from '../src/db.js';

describe('persistent database', () => {
  before(async () => { await initDB(); });
  it('initializes and verifies storage', async () => {
    assert.equal(await verifyAccess(), true);
  });
  it('persists registrations, tiers and queue state across reads', async () => {
    await withDB(async db => {
      db['test-guild'] = {
        registrations: { 'test-user': { gamertag:'Notch', registeredAt:new Date().toISOString() } },
        results: { 'test-user': { Sword: { tier:'HT2', updatedAt:new Date().toISOString() } } },
        queue: ['test-user'], tickets: {}
      };
    });
    const loaded = await readDB();
    assert.equal(loaded['test-guild'].registrations['test-user'].gamertag, 'Notch');
    assert.equal(loaded['test-guild'].results['test-user'].Sword.tier, 'HT2');
    assert.deepEqual(loaded['test-guild'].queue, ['test-user']);
    const normalized = await getRegistration('test-guild','test-user');
    assert.equal(normalized.gamertag, 'Notch');
  });
  it('serializes concurrent updates without losing writes', async () => {
    await Promise.all(Array.from({length:8}, (_,i)=>withDB(async db=>{
      db['test-guild'].queue.push(`user-${i}`);
    })));
    const q = (await readDB())['test-guild'].queue;
    for (let i=0;i<8;i++) assert.ok(q.includes(`user-${i}`));
  });
});

import { claimTicketState } from '../src/tickets.js';

describe('ticket claim concurrency', () => {
  it('allows exactly one simultaneous claimant', async () => {
    await withDB(async db=>{ db['claim-guild']={tickets:{'claim-channel':{ownerId:'owner',mode:'Sword',status:'open',claimedBy:null}}}; });
    const outcomes = await Promise.allSettled([
      claimTicketState('claim-guild','claim-channel','tester-a'),
      claimTicketState('claim-guild','claim-channel','tester-b')
    ]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
    const ticket=(await readDB())['claim-guild'].tickets['claim-channel'];
    assert.ok(['tester-a','tester-b'].includes(ticket.claimedBy));
  });
});
