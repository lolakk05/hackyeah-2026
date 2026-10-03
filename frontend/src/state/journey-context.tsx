import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchLandmarks, planTrip } from '@/api/client';
import type { Landmark, TripPlan, TripPreferences } from '@/api/types';

export const XP_PER_STOP = 50;

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
  xp: number;
  isFinished: boolean;

  /** Landmarks shown on the roadmap: the planned stops, or every landmark before planning. */
  roadmap: Landmark[];
  statusOf: (id: string) => StopStatus;

  startTrip: (prefs: TripPreferences) => Promise<void>;
  completeStop: (id: string) => void;
  resetTrip: () => void;
}

const JourneyContext = createContext<JourneyState | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [preferences, setPreferences] = useState<TripPreferences>(DEFAULT_PREFERENCES);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
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
  }, [reloadKey]);

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
    },
    [landmarks],
  );

  const completeStop = useCallback((id: string) => {
    setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const resetTrip = useCallback(() => {
    setPlan(null);
    setCompletedIds([]);
  }, []);

  const value: JourneyState = {
    landmarks,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
    preferences,
    plan,
    completedIds,
    currentId,
    xp: completedIds.length * XP_PER_STOP,
    isFinished: !!plan && plan.stopIds.length > 0 && currentId === null,
    roadmap,
    statusOf,
    startTrip,
    completeStop,
    resetTrip,
  };

  return <JourneyContext value={value}>{children}</JourneyContext>;
}

export function useJourney(): JourneyState {
  const ctx = use(JourneyContext);
  if (!ctx) throw new Error('useJourney must be used inside <JourneyProvider>');
  return ctx;
}
