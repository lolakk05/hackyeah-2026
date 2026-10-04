import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteFinderError } from '@/api/client';
import { USE_MOCK_API, MINUTES_PER_STOP } from '@/api/config';
import { planTripLocally } from '@/api/trip-planner';
import type { TripPreferences } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { AccessibilityFilter } from '@/components/trip/accessibility-filter';
import { TripLengthSlider } from '@/components/trip/trip-length-slider';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import type { Strings } from '@/i18n/strings';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

type StartMode = 'market' | 'myLocation';

/** Trip setup: length, start point and accessibility; then the route planner builds the route. */
export default function SetupScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { preferences, landmarks, startTrip } = useJourney();
  const [prefs, setPrefs] = useState<TripPreferences>(preferences);
  const [startMode, setStartMode] = useState<StartMode>('market');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock mode: instant local preview of how many stops fit.
  const preview = useMemo(() => planTripLocally(landmarks, prefs), [landmarks, prefs]);
  const n = preview.stopIds.length;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      let startLocation: TripPreferences['startLocation'];
      if (startMode === 'myLocation') {
        // Wait for GPS; on failure tell the user instead of silently starting elsewhere.
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') throw new Error('permission');
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          startLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch {
          setError(s.setup.locationError);
          return;
        }
      }
      // The route planner picks the places and the route; the roadmap shows them.
      await startTrip({ ...prefs, startLocation });
      router.replace('/roadmap');
    } catch (e) {
      setError(errorMessage(e, s, fmt));
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={s.common.back} hitSlop={12}>
          <DuoText variant="title" color={t.textMuted}>
            ←
          </DuoText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <DuoText variant="title" accessibilityRole="header">
          {s.setup.question}
        </DuoText>

        <TripLengthSlider value={prefs.durationMinutes} onChange={(v) => setPrefs({ ...prefs, durationMinutes: v })} />

        {!USE_MOCK_API ? (
          <View style={styles.group}>
            <DuoText variant="label" color={t.textMuted}>
              {s.setup.startFrom}
            </DuoText>
            <View style={styles.segment}>
              {(
                [
                  ['market', `🏛️ ${s.setup.startMarket}`],
                  ['myLocation', `📍 ${s.setup.startMyLocation}`],
                ] as [StartMode, string][]
              ).map(([mode, label]) => (
                <Pressable
                  key={mode}
                  style={[styles.segmentItem, startMode === mode && styles.segmentItemOn]}
                  onPress={() => {
                    tapFeedback();
                    setStartMode(mode);
                    setError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: startMode === mode }}>
                  <DuoText variant="body" color={startMode === mode ? Brand.onPrimary : t.text} style={styles.segmentText}>
                    {label}
                  </DuoText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <AccessibilityFilter value={prefs.needs} onChange={(needs) => setPrefs({ ...prefs, needs })} />

        <View style={styles.preview} accessibilityLiveRegion="polite">
          {USE_MOCK_API ? (
            <>
              <DuoText variant="heading">
                🗺️{' '}
                {n === 1
                  ? fmt(s.setup.previewOne, { time: formatDuration(preview.totalMinutes) })
                  : fmt(s.setup.previewMany, { n, time: formatDuration(preview.totalMinutes) })}
              </DuoText>
              {preview.skippedForAccessibility.length > 0 ? (
                <DuoText variant="caption" color={t.textMuted}>
                  {fmt(s.setup.skipped, { n: preview.skippedForAccessibility.length })}
                </DuoText>
              ) : null}
            </>
          ) : (
            <>
              <DuoText variant="heading">
                🗺️ {fmt(s.setup.walkPreview, {
                  time: formatDuration(prefs.durationMinutes),
                  n: 2 + Math.min(10, Math.max(1, Math.round(prefs.durationMinutes / MINUTES_PER_STOP))),
                })}
              </DuoText>
              <DuoText variant="caption" color={t.textMuted}>
                {s.setup.walkOnlyNote}
              </DuoText>
            </>
          )}
        </View>

        {error ? (
          <View style={styles.error} accessibilityRole="alert">
            <DuoText variant="body" color={Brand.danger}>
              {error}
            </DuoText>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <DuoButton
          title={s.setup.buildRoute}
          onPress={start}
          loading={starting}
          disabled={USE_MOCK_API && n === 0}
        />
      </View>
    </SafeAreaView>
  );
}

/** Friendly message for planner errors (codes from FRONTEND_INTEGRATION.md §8). */
function errorMessage(e: unknown, s: Strings, fmt: (t: string, p?: Record<string, string | number>) => string): string {
  if (!(e instanceof RouteFinderError)) return fmt(s.setup.errors.generic, { msg: String(e) });
  switch (e.code) {
    case 'no_start_poi':
      return s.setup.errors.noStart;
    case 'no_candidate_pois':
    case 'no_route_within_budget':
      return s.setup.errors.noRoute;
    case 'planner_busy':
    case 'osrm_busy':
    case 'osrm_rate_limited':
    case 'planning_timeout':
    case 'osrm_timeout':
    case 'osrm_unavailable':
    case 'osrm_invalid_response':
    case 'osrm_http_error':
      return fmt(s.setup.errors.busy, { s: e.retryAfterS ?? 10 });
    case 'network':
    case 'client_timeout':
      return s.setup.errors.network;
    case 'validation_error':
      return fmt(s.setup.errors.invalid, { msg: e.message });
    default:
      return fmt(s.setup.errors.generic, { msg: e.message });
  }
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row' },
  content: { padding: 20, paddingTop: 4, gap: 20, maxWidth: 600, width: '100%', alignSelf: 'center' },
  group: { gap: 10 },
  segment: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: 999, backgroundColor: t.card },
  segmentItem: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentItemOn: { backgroundColor: Brand.primary },
  segmentText: { fontWeight: '700' },
  preview: {
    padding: 16,
    borderRadius: t.radius.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    gap: 6,
  },
  error: { padding: 14, borderRadius: t.radius.md, backgroundColor: t.soft(Brand.danger, 0.85) },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
}));
