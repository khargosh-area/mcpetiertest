export interface TierCardOptions {
  gamertag: string;
  mode: string;
  tier: string;
  tester?: string | { username?: string } | null;
  previousTier?: string | null;
  note?: string;
  region?: string;
  device?: string;
  withSkin?: boolean;
}

export function fetchSkin(gamertag: string, options?: { timeout?: number }): Promise<string | null>;

export function buildTierCard(options: TierCardOptions): Promise<{ buffer: Buffer; ext: 'png' | 'svg' }>;
