/**
 * Achievements: badges for things done over time (trips, kilometres,
 * places, accessibility answers, reports, level). Counted from the same XP
 * events the backend gets, and kept per user on the phone.
 */
import type { XpEvent } from '@/api/types';

export interface PlayerStats {
  /** Finished routes. */
  trips: number;
  /** Metres walked between stops. */
  meters: number;
  /** Longest finished route, in metres. */
  longestTrip: number;
  /** Stops reached (with repeats). */
  visits: number;
  /** Different places reached. */
  places: string[];
  /** Yes/no accessibility answers. */
  answers: number;
  /** Problem reports sent. */
  issues: number;
}

export const EMPTY_STATS: PlayerStats = {
  trips: 0,
  meters: 0,
  longestTrip: 0,
  visits: 0,
  places: [],
  answers: 0,
  issues: 0,
};

/** Update the stats with one XP event. */
export function applyEvent(stats: PlayerStats, event: Pick<XpEvent, 'type' | 'distanceMeters' | 'landmarkId'>): PlayerStats {
  const m = Math.max(0, event.distanceMeters ?? 0);
  switch (event.type) {
    case 'visit':
      return {
        ...stats,
        visits: stats.visits + 1,
        meters: stats.meters + m,
        places:
          event.landmarkId && !stats.places.includes(event.landmarkId)
            ? [...stats.places, event.landmarkId]
            : stats.places,
      };
    case 'route_complete':
      return { ...stats, trips: stats.trips + 1, longestTrip: Math.max(stats.longestTrip, m) };
    case 'report':
      return { ...stats, answers: stats.answers + 1 };
    case 'issue_report':
      return { ...stats, issues: stats.issues + 1 };
  }
}

export type AchievementId =
  | 'firstTrip'
  | 'trips5'
  | 'trips15'
  | 'km10'
  | 'km42'
  | 'longTrip'
  | 'places10'
  | 'places30'
  | 'answers5'
  | 'answers25'
  | 'firstIssue'
  | 'issues10'
  | 'level5';

export interface Achievement {
  id: AchievementId;
  icon: string;
  target: number;
  /** Current progress towards `target`. */
  value: (s: PlayerStats, level: number) => number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstTrip', icon: '👣', target: 1, value: (s) => s.trips },
  { id: 'trips5', icon: '🗺️', target: 5, value: (s) => s.trips },
  { id: 'trips15', icon: '🧭', target: 15, value: (s) => s.trips },
  { id: 'km10', icon: '🥾', target: 10, value: (s) => Math.floor(s.meters / 1000) },
  { id: 'km42', icon: '🏅', target: 42, value: (s) => Math.floor(s.meters / 1000) },
  { id: 'longTrip', icon: '🚶', target: 3, value: (s) => Math.floor(s.longestTrip / 1000) },
  { id: 'places10', icon: '📍', target: 10, value: (s) => s.places.length },
  { id: 'places30', icon: '🏰', target: 30, value: (s) => s.places.length },
  { id: 'answers5', icon: '♿', target: 5, value: (s) => s.answers },
  { id: 'answers25', icon: '🦸', target: 25, value: (s) => s.answers },
  { id: 'firstIssue', icon: '⚠️', target: 1, value: (s) => s.issues },
  { id: 'issues10', icon: '👀', target: 10, value: (s) => s.issues },
  { id: 'level5', icon: '⭐', target: 5, value: (_, level) => level },
];

/** Ids of unlocked achievements. */
export function unlockedIds(stats: PlayerStats, level: number): AchievementId[] {
  return ACHIEVEMENTS.filter((a) => a.value(stats, level) >= a.target).map((a) => a.id);
}
