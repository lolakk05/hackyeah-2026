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
import { formatDuration } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Trip setup: length slider + accessibility filter, then the API builds the route. */
export default function SetupScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { preferences, landmarks, startTrip } = useJourney();
  const [prefs, setPrefs] = useState<TripPreferences>(preferences);
  const [starting, setStarting] = useState(false);

  // Instant local preview of how many stops fit (the real plan comes from planTrip()).
  const preview = useMemo(() => planTripLocally(landmarks, prefs), [landmarks, prefs]);
  const n = preview.stopIds.length;
  const time = formatDuration(preview.totalMinutes);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

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

        <AccessibilityFilter value={prefs.needs} onChange={(needs) => setPrefs({ ...prefs, needs })} />

        <View style={styles.preview} accessibilityLiveRegion="polite">
          <DuoText variant="heading">
            🗺️ {n === 1 ? fmt(s.setup.previewOne, { time }) : fmt(s.setup.previewMany, { n, time })}
          </DuoText>
          {preview.skippedForAccessibility.length > 0 ? (
            <DuoText variant="caption" color={t.textMuted}>
              {fmt(s.setup.skipped, { n: preview.skippedForAccessibility.length })}
            </DuoText>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DuoButton title={s.setup.buildRoute} onPress={start} loading={starting} disabled={n === 0} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row' },
  content: { padding: 20, paddingTop: 4, gap: 20, maxWidth: 600, width: '100%', alignSelf: 'center' },
  preview: {
    padding: 16,
    borderRadius: t.radius.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    gap: 4,
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
}));
