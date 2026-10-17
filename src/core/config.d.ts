export const MODES: string[];
export const TIERS: string[];
export const HIGH_TIERS: string[];
export const MODE_ICONS: Record<string, string>;
export const APP_EMOJIS: Record<string, string>;
export const TIER_COLORS: Record<string, string>;
export const CHANNEL_PLAN: [string, string][];
export const CATEGORY_NAME: string;

export const BRAND: {
  name: string;
  tagline: string;
  version: string;
  accent: string;
  accentSoft: string;
};

export interface CommandOption {
  name: string;
  type: string;
  required: boolean;
  choices?: string[];
}

export interface CommandInfo {
  name: string;
  description: string;
  permission: string;
  options: CommandOption[];
}

export const COMMAND_CATALOG: CommandInfo[];

export function aestheticTier(tier: string): string;
export function tierAccent(tier: string): string;
export function aestheticMode(mode: string): string;
export function roleName(mode: string, tier: string): string;
export function testerRoleName(mode: string): string;
export function tierRank(tier: string): number;
export function isValidMode(mode: string): boolean;
export function isValidTier(tier: string): boolean;
export function escapeXml(value: unknown): string;
