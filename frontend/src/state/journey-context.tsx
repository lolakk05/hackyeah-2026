import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { awardPoints, fetchLandmarks, planTrip, submitAccessibilityReport } from '@/api/client';
import { MAP_DATA_URL } from '@/api/config';
import type { AccessibilityReport, Landmark, LatLng, ReportCategory, TripPlan, TripPreferences } from '@/api/types';
import { useI18n } from '@/i18n/language-context';
import { allLandmarkNamePatterns } from '@/map/landmark-placement';
import { loadMapData } from '@/map/osm';

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
  /** Experience points (total from the API). */
  xp: number;
  isFinished: boolean;

  /** Landmarks shown on the roadmap: the planned stops, or every landmark before planning. */
  roadmap: Landmark[];
  statusOf: (id: string) => StopStatus;

  startTrip: (prefs: TripPreferences) => Promise<void>;
  /** Mark a stop visited and award XP through the API. Returns the points awarded. */
  completeStop: (id: string) => Promise<number>;
  resetTrip: () => void;

  /** The walking path of the current leg (set by the map), used for accessibility reports. */
  setLegPath: (toStopId: string, path: LatLng[]) => void;
  /** Send a yes/no accessibility answer for the leg that ended at `toStopId`. Returns XP awarded. */
  reportLeg: (toStopId: string, category: ReportCategory, accessible: boolean) => Promise<number>;
}

const JourneyContext = createContext<JourneyState | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [preferences, setPreferences] = useState<TripPreferences>(DEFAULT_PREFERENCES);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [xp, setXp] = useState(0);
  const [legPaths, setLegPaths] = useState<Record<string, LatLng[]>>({});

  // Landmarks (in the chosen language)
  useEffect(() => {
    if (!lang) return;
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
      setPreferences(prefs);
      const newPlan = await planTrip(prefs, landmarks);
      setPlan(newPlan);
      setCompletedIds([]);
      setLegPaths({});
    },
    [landmarks],
  );

  const completeStop = useCallback(async (id: string) => {
    setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    try {
      const res = await awardPoints(id, 'visit');
      setXp(res.total);
      return res.awarded;
    } catch {
      return 0;
    }
  }, []);

  const resetTrip = useCallback(() => {
    setPlan(null);
    setCompletedIds([]);
    setLegPaths({});
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
      const path = legPaths[toStopId] ?? [from?.coordinates, to?.coordinates].filter((p): p is LatLng => !!p);
      const report: AccessibilityReport = {
        category,
        accessible,
        segment: { fromStopId, toStopId, path },
        needs: preferences.needs,
        createdAt: new Date().toISOString(),
      };
      try {
        await submitAccessibilityReport(report);
        const res = await awardPoints(toStopId, 'report');
        setXp(res.total);
        return res.awarded;
      } catch {
        return 0;
      }
    },
    [plan, landmarks, legPaths, preferences.needs],
  );

  const value: JourneyState = {
    landmarks,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
    preferences,
    plan,
    completedIds,
    currentId,
    xp,
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
