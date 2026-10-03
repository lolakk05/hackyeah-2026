/**
 * ─────────────────────────────────────────────────────────────
 *  XP RULES, LEVELS AND COINS
 * ─────────────────────────────────────────────────────────────
 * The backend is the source of truth for points (it should use the same
 * rules, see src/api/README.md). The app uses these rules for the sample
 * backend, for offline estimates and to explain the rules to the visitor.
 *
 * Most XP comes from answering accessibility questions; reaching a landmark
 * and finishing a route also give XP, and longer walks give more.
 */
import type { XpEvent } from '@/api/types';

export const XP_RULES = {
  /** Each yes/no accessibility answer. */
  report: 50,
  /** Reaching a landmark… */
  visitBase: 5,
  /** …plus this much per 100 m walked to it. */
  visitPer100m: 1,
  /** Finishing the whole route… */
  routeBase: 20,
  /** …plus this much per km of the route. */
  routePerKm: 10,
} as const;

/** Virtual coins earned per XP point. */
export const COINS_PER_XP = 0.5;

/** XP for one event (same formula as the backend should use). */
export function xpForEvent(event: Pick<XpEvent, 'type' | 'distanceMeters'>): number {
  const meters = Math.max(0, event.distanceMeters ?? 0);
  switch (event.type) {
    case 'report':
      return XP_RULES.report;
    case 'visit':
      return XP_RULES.visitBase + Math.round((meters / 100) * XP_RULES.visitPer100m);
    case 'route_complete':
      return XP_RULES.routeBase + Math.round((meters / 1000) * XP_RULES.routePerKm);
  }
}

export const coinsForXp = (xp: number) => Math.round(xp * COINS_PER_XP * 10) / 10;

/**
 * Levels: level 2 needs 100 XP, and every next level needs 50 XP more than
 * the one before (100, 150, 200, …) → total 100, 250, 450, 700, 1000…
 */
export function xpToReachLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return 100 * n + 25 * n * (n - 1);
}

export interface LevelInfo {
  level: number;
  /** XP collected inside the current level. */
  xpIntoLevel: number;
  /** XP the current level needs in total. */
  xpForNextLevel: number;
  /** 0…1 progress to the next level. */
  progress: number;
  /** XP still missing for the next level. */
  xpToNext: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xp >= xpToReachLevel(level + 1)) level++;
  const start = xpToReachLevel(level);
  const end = xpToReachLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - start,
    xpForNextLevel: end - start,
    progress: (xp - start) / (end - start),
    xpToNext: end - xp,
  };
}

/** Coins with at most one decimal (0.5 steps), using the language's decimal sign. */
export function formatCoins(coins: number, lang: 'pl' | 'en' | null): string {
  const text = Number.isInteger(coins) ? String(coins) : coins.toFixed(1);
  return lang === 'pl' ? text.replace('.', ',') : text;
}
