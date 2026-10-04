import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchAllLandmarks, fetchLandmarks, planTrip, submitAccessibilityReport } from '@/api/client';
import { MAP_DATA_URL } from '@/api/config';
import type { AccessibilityReport, Landmark, LatLng, ReportCategory, TripPlan, TripPreferences } from '@/api/types';
import { useI18n } from '@/i18n/language-context';
import { distanceMeters } from '@/map/geo';
import { allLandmarkNamePatterns } from '@/map/landmark-placement';
import { loadMapData } from '@/map/osm';

import { useAccount, type XpAward } from './account-context';

export const DEFAULT_PREFERENCES: TripPreferences = {
  durationMinutes: 120,
  needs: { wheelchair: false, reducedMobility: false, lowVision: false, hearing: false },
};

export type StopStatus = 'completed' | 'current' | 'locked';

interface JourneyState {
  landmarks: Landmark[];
  loading: boolean;
  error: string | null;
  reload: () => void;

  preferences: TripPreferences;
  plan: TripPlan | null;
  completedIds: string[];
  /** Id of the next stop to visit, or null when no trip / trip finished. */
  currentId: string | null;
  /** XP earned on the current trip. */
  tripXp: number;
  isFinished: boolean;

  /** Every place for the "Places" screen. */
  allPlaces: Landmark[];
  placesState: 'idle' | 'loading' | 'ready' | 'error';
  loadAllPlaces: () => Promise<void>;

  /** Landmarks shown on the roadmap: the planned stops, or every landmark before planning. */
  roadmap: Landmark[];
  statusOf: (id: string) => StopStatus;

  startTrip: (prefs: TripPreferences) => Promise<void>;
  /**
   * Mark a stop visited and earn XP (more for a longer walk to it).
   * After the last stop the route bonus is added too.
   */
  completeStop: (id: string) => Promise<StopReward>;
  resetTrip: () => void;

  /** The walking path of the current leg (set by the map), used for accessibility reports. */
  setLegPath: (toStopId: string, path: LatLng[]) => void;
  /** Send a yes/no accessibility answer for the leg that ended at `toStopId`. Returns what it earned. */
  reportLeg: (toStopId: string, category: ReportCategory, accessible: boolean) => Promise<XpAward>;
}

/** What reaching a stop earned. */
export interface StopReward {
  visit: XpAward;
  /** Bonus for finishing the whole route (only after the last stop). */
  route: XpAward | null;
}

/** Walking is ~30% longer than the straight line between two points. */
const WALK_FACTOR = 1.3;

const JourneyContext = createContext<JourneyState | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const { award } = useAccount();
  const [catalog, setLandmarks] = useState<Landmark[]>([]);
  /** Places returned with the current plan (from the route planner). */
  const [planLandmarks, setPlanLandmarks] = useState<Landmark[]>([]);
  /** Every place (the "Places" screen), loaded when that screen opens. */
  const [allPlaces, setAllPlaces] = useState<Landmark[]>([]);
  const [placesState, setPlacesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const landmarks = useMemo(() => {
    const ids = new Set(planLandmarks.map((l) => l.id));
    const rest = [...catalog, ...allPlaces].filter((l) => !ids.has(l.id) && (ids.add(l.id), true));
    return [...planLandmarks, ...rest];
  }, [catalog, planLandmarks, allPlaces]);

  const loadAllPlaces = useCallback(async () => {
    setPlacesState('loading');
    try {
      setAllPlaces(await fetchAllLandmarks());
      setPlacesState('ready');
    } catch {
      setPlacesState('error');
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [preferences, setPreferences] = useState<TripPreferences>(DEFAULT_PREFERENCES);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [tripXp, setTripXp] = useState(0);
  const [legPaths, setLegPaths] = useState<Record<string, LatLng[]>>({});

  // Landmarks (in the chosen language)
  useEffect(() => {
    // Load even before a language is picked (e.g. a web page opened on /roadmap):
    // English until then, reloaded in the chosen language when it changes.
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLandmarks()
      .then((data) => !cancelled && setLandmarks(data))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey, lang]);

  useEffect(() => {
    setAllPlaces([]);
    setPlacesState('idle');
  }, [lang]);

  // Start downloading the 3D map's buildings early, so the map opens fast later.
  useEffect(() => {
    loadMapData(allLandmarkNamePatterns(), MAP_DATA_URL).catch(() => {
      // the map screen shows its own retry button
    });
  }, []);

  const roadmap = useMemo(() => {
    if (!plan) return landmarks;
    const byId = new Map(landmarks.map((l) => [l.id, l]));
    return plan.stopIds.map((id) => byId.get(id)).filter((l): l is Landmark => !!l);
  }, [landmarks, plan]);

  const currentId = useMemo(() => {
    if (!plan) return null;
    return plan.stopIds.find((id) => !completedIds.includes(id)) ?? null;
  }, [plan, completedIds]);

  const statusOf = useCallback(
    (id: string): StopStatus => {
      if (completedIds.includes(id)) return 'completed';
      if (id === currentId) return 'current';
      return 'locked';
    },
    [completedIds, currentId],
  );

  const startTrip = useCallback(
    async (prefs: TripPreferences) => {
      const result = await planTrip(prefs, catalog);
      setPreferences(prefs);
      setPlanLandmarks(result.landmarks);
      setPlan(result.plan);
      setCompletedIds([]);
      setLegPaths({});
      setTripXp(0);
    },
    [catalog],
  );

  /** Metres walked to a stop: the planner's leg, else the straight line from the previous stop. */
  const legDistance = useCallback(
    (id: string): number => {
      const leg = plan?.route?.legs.find((l) => l.toId === id);
      if (leg) return leg.distanceMeters;
      const index = plan?.stopIds.indexOf(id) ?? -1;
      if (!plan || index <= 0) return 0;
      const a = landmarks.find((l) => l.id === plan.stopIds[index - 1]);
      const b = landmarks.find((l) => l.id === id);
      return a && b ? distanceMeters(a.coordinates, b.coordinates) * WALK_FACTOR : 0;
    },
    [plan, landmarks],
  );

  const completeStop = useCallback(
    async (id: string): Promise<StopReward> => {
      const none = { visit: { xp: 0, coins: 0 }, route: null };
      if (!plan || completedIds.includes(id)) return none;
      const isLast = plan.stopIds.every((s) => s === id || completedIds.includes(s));
      setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

      const visit = await award({ type: 'visit', landmarkId: id, distanceMeters: Math.round(legDistance(id)) });
      let route: XpAward | null = null;
      if (isLast) {
        const routeMeters =
          plan.route?.distanceMeters ?? plan.stopIds.reduce((sum, s) => sum + legDistance(s), 0);
        route = await award({
          type: 'route_complete',
          distanceMeters: Math.round(routeMeters),
          stops: plan.stopIds.length,
        });
      }
      setTripXp((x) => x + visit.xp + (route?.xp ?? 0));
      return { visit, route };
    },
    [plan, completedIds, award, legDistance],
  );

  const resetTrip = useCallback(() => {
    setPlan(null);
    setPlanLandmarks([]);
    setCompletedIds([]);
    setLegPaths({});
    setTripXp(0);
  }, []);

  const setLegPath = useCallback((toStopId: string, path: LatLng[]) => {
    setLegPaths((prev) => ({ ...prev, [toStopId]: path }));
  }, []);

  const reportLeg = useCallback(
    async (toStopId: string, category: ReportCategory, accessible: boolean) => {
      const index = plan?.stopIds.indexOf(toStopId) ?? -1;
      const fromStopId = index > 0 ? plan!.stopIds[index - 1] : null;
      const byId = (id: string | null) => landmarks.find((l) => l.id === id);
      const to = byId(toStopId);
      const from = byId(fromStopId);
      const plannedLeg = plan?.route?.legs.find((l) => l.toId === toStopId)?.path;
      const path =
        legPaths[toStopId] ?? plannedLeg ?? [from?.coordinates, to?.coordinates].filter((p): p is LatLng => !!p);
      const report: AccessibilityReport = {
        category,
        accessible,
        segment: { fromStopId, toStopId, path },
        needs: preferences.needs,
        createdAt: new Date().toISOString(),
      };
      try {
        await submitAccessibilityReport(report);
      } catch {
        // kept on the phone by the client
      }
      const earned = await award({ type: 'report', landmarkId: toStopId, category });
      setTripXp((x) => x + earned.xp);
      return earned;
    },
    [plan, landmarks, legPaths, preferences.needs, award],
  );

  const value: JourneyState = {
    landmarks,
    allPlaces,
    placesState,
    loadAllPlaces,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
    preferences,
    plan,
    completedIds,
    currentId,
    tripXp,
    isFinished: !!plan && plan.stopIds.length > 0 && currentId === null,
    roadmap,
    statusOf,
    startTrip,
    completeStop,
    resetTrip,
    setLegPath,
    reportLeg,
  };

  return <JourneyContext value={value}>{children}</JourneyContext>;
}

export function useJourney(): JourneyState {
  const ctx = use(JourneyContext);
  if (!ctx) throw new Error('useJourney must be used inside <JourneyProvider>');
  return ctx;
}
