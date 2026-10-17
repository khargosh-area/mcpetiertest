const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = process.env.LOG_LEVEL || 'info';

function fmt(level, msg, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  if (meta) {
    try { return base + ' ' + JSON.stringify(meta); } catch { return base; }
  }
  return base;
}

export const logger = {
  setLevel(l) { currentLevel = l; },
  debug(msg, meta) { if (LEVELS[currentLevel] <= LEVELS.debug) console.log(fmt('debug', msg, meta)); },
  info(msg, meta)  { if (LEVELS[currentLevel] <= LEVELS.info) console.log(fmt('info', msg, meta)); },
  warn(msg, meta)  { console.warn(fmt('warn', msg, meta)); },
  error(msg, meta) { console.error(fmt('error', msg, meta)); },
  boot(msg, meta)  { console.log(`[BOOT] ${msg}`, meta ? JSON.stringify(meta) : ''); },
  health(msg, meta){ console.log(`[HEALTH] ${msg}`, meta ? JSON.stringify(meta) : ''); }
};

export function logError(context, err) {
  const stack = err?.stack || err?.message || String(err);
  logger.error(`${context}: ${stack}`);
}
