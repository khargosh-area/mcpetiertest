export const MODES = ['Sword','Axe','Mace','UHC','Pot','NethPot','SMP','Crystal','Bedrock','Combo'];
export const TIERS = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];

export const MODE_ICONS = {
  Sword: '⚔️', Axe: '🪓', Mace: '🔨', UHC: '❤️', Pot: '🧪',
  NethPot: '💥', SMP: '🛡️', Crystal: '💎', Bedrock: '🪨', Combo: '⚡'
};

export const CHANNEL_PLAN = [
  ['📜・tier-rules', 'rules'],
  ['🧰・tier-kits', 'kits'],
  ['📝・tier-apply', 'apply'],
  ['⏳・tier-queue', 'queue'],
  ['➕・join-queue', 'join'],
  ['🏆・tier-results', 'results'],
  ['🔥・high-tier-result', 'high'],
  ['👑・official-ranking', 'ranking'],
  ['⚠️・punishment', 'punishment'],
  ['📚・tier-content', 'content']
];

export const TICKET_CATEGORY_NAME = '🎫・TIER TICKETS';
export const TESTING_CATEGORY_NAME = '🧪・TIER TESTING';

export const GAMERTAG_REGEX = /^[a-zA-Z0-9_]{3,16}$/;
export const MAX_NOTE_LENGTH = 200;
export const MAX_GAMERTAG_LENGTH = 16;

export function aestheticTier(tier) {
  const map = { '1':'¹','2':'²','3':'³','4':'⁴','5':'⁵' };
  const m = String(tier || '').match(/^(HT|LT)([1-5])$/i);
  return m ? `${m[1][0] === 'H' ? 'ʜ' : 'ʟ'}ᴛ${map[m[2]]}` : String(tier || '');
}
export function aestheticMode(mode) {
  return String(mode).toLowerCase().replace(/^[a-z]/, c => c.toLowerCase())
    .replace('nethpot','ɴᴇᴛʜᴘᴏᴛ').replace('sword','sᴡᴏʀᴅ').replace('axe','ᴀxᴇ').replace('mace','ᴍᴀᴄᴇ')
    .replace('uhc','ᴜʜᴄ').replace('pot','ᴘᴏᴛ')
    .replace('smp','sᴍᴘ').replace('crystal','ᴄʀʏsᴛᴀʟ').replace('bedrock','ʙᴇᴅʀᴏᴄᴋ').replace('combo','ᴄᴏᴍʙᴏ');
}
export function roleName(mode, tier) { return `${aestheticMode(mode)} • ${aestheticTier(tier)}`; }
export function testerRoleName(mode) { return `${mode} Tester`; }
export function testerRoleNameAesthetic(mode) { return `${aestheticMode(mode)} Tester`; }

export function tierAccent(tier) {
  const colors = { HT1:'#ff4d67', LT1:'#ff6b81', HT2:'#ff9f43', LT2:'#ffb35c', HT3:'#ffd166', LT3:'#ffe08a', HT4:'#56d6ff', LT4:'#7de0ff', HT5:'#a78bfa', LT5:'#c4b5fd' };
  return colors[tier] || '#7c3aed';
}
export function tierOrder(tier) {
  const idx = TIERS.indexOf(tier);
  return idx === -1 ? 999 : idx;
}
export function escapeXml(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
