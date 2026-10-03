import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Landmark } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { TopBar } from '@/components/home/top-bar';
import { Roadmap } from '@/components/roadmap/roadmap';
import { UnitBanner } from '@/components/roadmap/unit-banner';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';
import { useJourney, type StopStatus } from '@/state/journey-context';

/**
 * Roadmap: the Duolingo-style path of stops the API picked for this trip
 * (based on trip length + accessibility). START ROUTE opens the 3D map.
 */
export default function RoadmapScreen() {
  const t = useDuo();
  const styles = useStyles();
  const j = useJourney();
  const { plan, landmarks, roadmap, currentId, completedIds } = j;

  const openPlace = (lm: Landmark) => router.push({ pathname: '/place/[id]', params: { id: lm.id } });
  const openSetup = () => router.push('/setup');
  const openMap = () => router.push('/map');

  // Before a trip is planned, the first stop is "current" so the map invites you to start.
  const statusOf = (id: string): StopStatus =>
    plan ? j.statusOf(id) : id === landmarks[0]?.id ? 'current' : 'locked';
  const bubbleFor = (lm: Landmark) => {
    if (statusOf(lm.id) !== 'current') return undefined;
    return !plan || completedIds.length === 0 ? 'START' : 'NEXT STOP';
  };
  const current = roadmap.find((l) => l.id === currentId);
  const skipped = plan?.skippedForAccessibility.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        city="Kraków"
        stats={[
          {
            icon: '⏱',
            value: plan ? formatDuration(j.preferences.durationMinutes) : '—',
            color: Brand.blue,
            a11y: 'Trip length',
          },
          {
            icon: '📍',
            value: plan ? `${completedIds.length}/${plan.stopIds.length}` : `${landmarks.length}`,
            color: Brand.red,
            a11y: 'Stops visited',
          },
          { icon: '⚡', value: `${j.xp}`, color: Brand.orange, a11y: 'Experience points' },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <UnitBanner
          overline={plan ? `Best route for you · ${formatDuration(plan.totalMinutes)}` : 'Kraków · Old Town & Kazimierz'}
          title={plan ? `${plan.stopIds.length} stops to explore` : 'Plan your sightseeing trip'}
          color={Brand.green}
          actionLabel={plan ? '⚙️ EDIT' : undefined}
          onAction={openSetup}
        />

        {skipped > 0 ? (
          <View style={styles.notice} accessibilityRole="text">
            <DuoText style={styles.noticeIcon}>♿</DuoText>
            <DuoText variant="caption" color={t.blueText} style={styles.noticeText}>
              We skipped {skipped} {skipped === 1 ? 'place that doesn’t' : 'places that don’t'} match your
              accessibility needs.
            </DuoText>
          </View>
        ) : null}

        {j.loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Brand.green} />
            <DuoText variant="body" color={t.textMuted}>
              Loading Kraków…
            </DuoText>
          </View>
        ) : j.error ? (
          <View style={styles.center}>
            <DuoText variant="heading">😕 Couldn’t load places</DuoText>
            <DuoText variant="caption" color={t.textMuted} style={styles.errorText}>
              {j.error}
            </DuoText>
            <DuoButton title="Try again" variant="blue" size="md" onPress={j.reload} />
          </View>
        ) : (
          <Roadmap
            landmarks={roadmap}
            statusOf={statusOf}
            bubbleFor={bubbleFor}
            onPressStop={(lm) => (!plan && statusOf(lm.id) === 'current' ? openSetup() : openPlace(lm))}
          />
        )}

        {j.isFinished ? (
          <View style={styles.finish}>
            <DuoText style={styles.trophy}>🏆</DuoText>
            <DuoText variant="title" color={Brand.yellowDark}>
              Trip complete!
            </DuoText>
            <DuoText variant="body" color={t.textMuted}>
              You visited {completedIds.length} places and earned {j.xp} XP.
            </DuoText>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {!plan ? (
          <DuoButton
            title="Start your journey"
            subtitle="Pick trip length & accessibility"
            onPress={openSetup}
            accessibilityHint="Opens trip settings"
          />
        ) : j.isFinished ? (
          <DuoButton
            title="Plan another trip"
            variant="orange"
            onPress={() => {
              j.resetTrip();
              openSetup();
            }}
          />
        ) : current ? (
          <DuoButton
            title={completedIds.length === 0 ? 'Start route' : 'Continue route'}
            subtitle={`🧭 Navigate to ${current.name}`}
            onPress={openMap}
            accessibilityHint="Opens the 3D map with directions"
          />
        ) : null}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  content: { padding: 16, paddingBottom: 48, maxWidth: 600, width: '100%', alignSelf: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: t.radius.md,
    backgroundColor: t.soft(Brand.blue),
  },
  noticeIcon: { fontSize: 22, lineHeight: 28 },
  noticeText: { flex: 1 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  errorText: { textAlign: 'center' },
  finish: { alignItems: 'center', gap: 6, marginTop: 32 },
  trophy: { fontSize: 64, lineHeight: 76 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 2,
    borderTopColor: t.border,
    backgroundColor: t.card,
  },
}));
