/**
 * Bot entry point.
 *
 * - `node index.js`              → run the bot locally (or on any always-on host)
 * - `import { runBotSession }`   → used by the Vercel background function
 */
import 'dotenv/config';
import { getStore, KEYS, logEvent } from './store.js';
import { createBot } from './bot.js';
import { BRAND } from './config.js';

const VERSION = BRAND.version;

function assertConfig() {
  const missing = ['DISCORD_TOKEN', 'CLIENT_ID'].filter(key => !process.env[key]?.trim());
  if (missing.length) {
    console.error(`[CONFIG ERROR] Missing ${missing.join(' and ')} environment variable.`);
    return false;
  }
  return true;
}

/**
 * Boot the bot and keep it alive.
 *
 * @param {object}  options
 * @param {number}  options.durationMs Stop automatically after this long (0 = never)
 * @param {string}  options.reason     Why the session was started (for logs)
 */
export async function runBotSession({ durationMs = 0, reason = 'manual' } = {}) {
  if (!assertConfig()) {
    return { ok: false, error: 'Missing DISCORD_TOKEN or CLIENT_ID' };
  }

  const store = await getStore();
  await logEvent(store, 'info', 'boot', `${BRAND.name} v${VERSION} starting (${reason}) · store=${store.kind}`);

  console.log(`[BOOT] ${BRAND.name} v${VERSION} starting...`);
  console.log('[BOOT] DISCORD_TOKEN present:', Boolean(process.env.DISCORD_TOKEN.trim()));
  console.log('[BOOT] CLIENT_ID present:', Boolean(process.env.CLIENT_ID.trim()));

  const bot = createBot({ store, version: VERSION });

  const onError = error => console.error('[UNCAUGHT EXCEPTION]', error?.stack || error);
  const onRejection = error => console.error('[UNHANDLED REJECTION]', error?.stack || error);
  process.on('unhandledRejection', onRejection);
  process.on('uncaughtException', onError);

  try {
    await bot.start();
  } catch (error) {
    console.error('[LOGIN ERROR]', error?.stack || error);
    await logEvent(store, 'error', 'boot', `Login failed: ${error.message}`);
    await bot.stop('login-error').catch(() => {});
    return { ok: false, error: error.message };
  }

  let stopping = false;
  const shutdown = async reason => {
    if (stopping) return;
    stopping = true;
    await logEvent(store, 'info', 'boot', `Shutting down (${reason})`);
    await bot.stop(reason).catch(() => {});
    clearInterval(timer);
    clearInterval(controlTimer);
    process.off('unhandledRejection', onRejection);
    process.off('uncaughtException', onError);
  };

  const timer = durationMs > 0
    ? setTimeout(() => shutdown(`session window (${Math.round(durationMs / 1000)}s)`), durationMs)
    : null;
  timer?.unref?.();

  // The dashboard can request a stop / restart through the shared store.
  const controlTimer = setInterval(async () => {
    try {
      const control = await store.get(KEYS.control);
      if (!control || control.handled) return;
      await store.set(KEYS.control, { ...control, handled: true, handledAt: new Date().toISOString() });
      if (control.action === 'stop' || control.action === 'restart') {
        await shutdown(`control:${control.action}`);
        if (control.action === 'restart') process.exit(0);
      }
    } catch {
      /* ignore transient store errors */
    }
  }, 5_000);
  controlTimer.unref?.();

  const onSigint = () => shutdown('SIGINT');
  const onSigterm = () => shutdown('SIGTERM');
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);

  return { ok: true, bot, shutdown };
}

/** Local / always-on host entry point. */
export async function startLocal() {
  const session = await runBotSession({ durationMs: 0, reason: 'local' });
  if (!session.ok) {
    process.exit(1);
  }
  console.log('[BOOT] Discord login initiated.');
  return session;
}
