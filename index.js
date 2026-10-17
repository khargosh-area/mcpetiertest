/**
 * TierTestBot — local entry point.
 *
 * `npm start` boots the Discord bot. The dashboard lives in the Next.js app
 * next to this file (`npm run dev`).
 */
import { startLocal } from './src/core/main.js';

startLocal().catch(error => {
  console.error('[FATAL]', error?.stack || error);
  process.exit(1);
});
