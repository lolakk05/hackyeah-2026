import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { planTripLocally } from '@/api/trip-planner';
import type { TripPreferences } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { AccessibilityFilter } from '@/components/trip/accessibility-filter';
import { TripLengthSlider } from '@/components/trip/trip-length-slider';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';
import { useJourney } from '@/state/journey-context';

/** Trip setup: length slider + accessibility filter, then the API builds the route. */
export default function SetupScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { preferences, landmarks, startTrip } = useJourney();
  const [prefs, setPrefs] = useState<TripPreferences>(preferences);
  const [starting, setStarting] = useState(false);

  // Instant local preview of how many stops fit (the real plan comes from planTrip()).
  const preview = useMemo(() => planTripLocally(landmarks, prefs), [landmarks, prefs]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const start = async () => {
    setStarting(true);
    try {
      // The API picks the best route for these settings; the roadmap shows it.
      await startTrip(prefs);
      router.replace('/roadmap');
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <DuoText variant="title" color={t.lockedText}>
            ✕
          </DuoText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <DuoText style={styles.mascot}>🐉</DuoText>
          <View style={styles.speech}>
            <DuoText variant="heading">How long do you want to explore Kraków?</DuoText>
          </View>
        </View>

        <TripLengthSlider value={prefs.durationMinutes} onChange={(v) => setPrefs({ ...prefs, durationMinutes: v })} />

        <AccessibilityFilter value={prefs.needs} onChange={(needs) => setPrefs({ ...prefs, needs })} />

        <View style={styles.preview} accessibilityLiveRegion="polite">
          <DuoText variant="heading" color={t.greenText}>
            🗺️ {preview.stopIds.length} {preview.stopIds.length === 1 ? 'stop' : 'stops'} · about{' '}
            {formatDuration(preview.totalMinutes)}
          </DuoText>
          {preview.skippedForAccessibility.length > 0 ? (
            <DuoText variant="caption" color={t.textMuted}>
              {preview.skippedForAccessibility.length} place(s) skipped because of your accessibility needs
            </DuoText>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DuoButton
          title="Build my route"
          onPress={start}
          loading={starting}
          disabled={preview.stopIds.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row' },
  content: { padding: 20, gap: 20, maxWidth: 600, width: '100%', alignSelf: 'center' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mascot: { fontSize: 64, lineHeight: 76 },
  speech: {
    flex: 1,
    borderWidth: 2,
    borderColor: t.border,
    borderRadius: t.radius.lg,
    padding: 14,
  },
  preview: {
    padding: 16,
    borderRadius: t.radius.lg,
    backgroundColor: t.soft(Brand.green),
    gap: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 2,
    borderTopColor: t.border,
  },
}));
