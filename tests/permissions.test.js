import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock minimal member/role logic for tester checks
function mockMember(roleIds, isAdmin=false) {
  return {
    permissions: { has: (flag) => isAdmin },
    roles: { cache: { has: (id) => roleIds.includes(id) } }
  };
}

describe('ticket tester logic', () => {
  it('admin bypass', () => {
    const cfg = { testerRoles: { Sword: '123' } };
    const admin = mockMember([], true);
    // Simulate isTesterForMode would return true for admin
    // We test mock directly
    assert.equal(admin.permissions.has(), true);
  });
  it('mode-specific role', () => {
    const member = mockMember(['swordRole']);
    assert.equal(member.roles.cache.has('swordRole'), true);
    assert.equal(member.roles.cache.has('axeRole'), false);
  });
  it('prevents cross-mode access conceptually', () => {
    const cfg = { testerRoles: { Sword: 'roleSword', Axe: 'roleAxe' } };
    const swordTester = mockMember(['roleSword']);
    const axeTester = mockMember(['roleAxe']);
    // Sword tester has Sword role, not Axe
    assert.equal(swordTester.roles.cache.has(cfg.testerRoles.Sword), true);
    assert.equal(swordTester.roles.cache.has(cfg.testerRoles.Axe), false);
    assert.equal(axeTester.roles.cache.has(cfg.testerRoles.Axe), true);
  });
});

describe('queue logic', () => {
  it('prevents duplicates', () => {
    let queue = ['user1','user2'];
    const user = 'user1';
    if (!queue.includes(user)) queue.push(user);
    assert.equal(queue.length, 2);
    const newUser = 'user3';
    if (!queue.includes(newUser)) queue.push(newUser);
    assert.equal(queue.length, 3);
  });
  it('maintains order', () => {
    const q = ['a','b','c'];
    assert.equal(q.indexOf('b'), 1);
  });
});

describe('role replacement', () => {
  it('only removes same mode', () => {
    const TIERS = ['HT1','LT1','HT2'];
    const roles = { Sword: { HT1:'1', LT1:'2' }, Axe: { HT1:'3' } };
    const memberRoles = new Set(['1','3']); // has Sword HT1 and Axe HT1
    const mode = 'Sword';
    const toRemove = [];
    for (const t of TIERS) {
      const id = roles[mode]?.[t];
      if (id && memberRoles.has(id)) toRemove.push(id);
    }
    assert.deepEqual(toRemove, ['1']); // only Sword tiers
    assert.ok(!toRemove.includes('3')); // Axe preserved
  });
});

import { isTesterForMode, ticketName } from '../src/tickets.js';
import { PermissionsBitField } from 'discord.js';

describe('actual ticket authorization helpers', () => {
  it('permits only the selected mode tester (or admin)', () => {
    const cfg = { testerRoles: { Sword:'sword-id', Axe:'axe-id' } };
    const member = ids => ({ permissions:{ has:()=>false }, roles:{ cache:{ has:id=>ids.includes(id) } } });
    assert.equal(isTesterForMode(member(['sword-id']), cfg, 'Sword'), true);
    assert.equal(isTesterForMode(member(['sword-id']), cfg, 'Axe'), false);
    assert.equal(isTesterForMode({permissions:{has:p=>p===PermissionsBitField.Flags.Administrator},roles:{cache:{has:()=>false}}},cfg,'Axe'),true);
  });
  it('builds a ticket name containing mode and identifier', () => {
    const name = ticketName('Sword','Notch_123',{username:'notch'});
    assert.match(name, /sword/);
    assert.match(name, /notch123/);
  });
});
