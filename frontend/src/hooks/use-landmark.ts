import { useEffect, useState } from 'react';

import { fetchLandmark } from '@/api/client';
import type { Landmark } from '@/api/types';
import { useJourney } from '@/state/journey-context';

/**
 * Landmark details for the place page.
 * Shows the list version instantly, then refreshes it from the detail endpoint
 * (which may have more photos and text).
 */
export function useLandmark(id: string | undefined) {
  const { landmarks } = useJourney();
  const cached = landmarks.find((l) => l.id === id) ?? null;

  const [landmark, setLandmark] = useState<Landmark | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchLandmark(id)
      // Keep the model chosen for the route (variants are spread out along it).
      .then((data) => !cancelled && setLandmark(cached ? { ...data, model: cached.model } : data))
      .catch((e: unknown) => {
        if (!cancelled && !cached) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { landmark: landmark ?? cached, loading, error };
}
