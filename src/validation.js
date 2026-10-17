import { GAMERTAG_REGEX, MODES, TIERS, MAX_NOTE_LENGTH } from './constants.js';

export function validateGamertag(tag) {
  if (!tag || typeof tag !== 'string') return { valid: false, reason: 'Gamertag is required.' };
  const trimmed = tag.trim();
  if (trimmed.length < 3 || trimmed.length > 16) return { valid: false, reason: 'Gamertag must be 3–16 characters.' };
  if (!GAMERTAG_REGEX.test(trimmed)) return { valid: false, reason: 'Gamertag may only contain letters, numbers and underscores.' };
  // Mojang also disallows starting/ending with underscore and consecutive underscores? Keep lenient.
  return { valid: true, value: trimmed };
}

export function validateMode(mode) {
  if (!MODES.includes(mode)) return { valid: false, reason: `Invalid gamemode. Choose: ${MODES.join(', ')}` };
  return { valid: true, value: mode };
}

export function validateTier(tier) {
  if (!TIERS.includes(tier)) return { valid: false, reason: `Invalid tier. Choose: ${TIERS.join(', ')}` };
  return { valid: true, value: tier };
}

export function sanitizeNote(note) {
  if (!note) return 'ggs';
  let s = String(note).trim().slice(0, MAX_NOTE_LENGTH);
  // Remove discord markdown abuse? Keep but limit.
  // Strip control chars
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return s || 'ggs';
}

export function validateRegion(region) {
  if (!region) return 'AS';
  const r = String(region).trim().slice(0, 10).toUpperCase();
  if (!/^[A-Z0-9_-]{1,10}$/.test(r)) return 'AS';
  return r;
}
export function validateDevice(device) {
  if (!device) return 'Mobile';
  return String(device).trim().slice(0, 20) || 'Mobile';
}
