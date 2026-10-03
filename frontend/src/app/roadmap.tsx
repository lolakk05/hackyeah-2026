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
import { useI18n } from '@/i18n/language-context';
import { useJourney, type StopStatus } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/**
 * Roadmap: the stops the API picked for this trip (based on trip length and
 * accessibility), as a timeline. START ROUTE opens the 3D map.
 */
export default function RoadmapScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const j = useJourney();
  const { plan, landmarks, roadmap, currentId, completedIds } = j;

  const openPlace = (lm: Landmark) => router.push({ pathname: '/place/[id]', params: { id: lm.id } });
  const openSetup = () => router.push('/setup');
  const openMap = () => router.push('/map');

  // Before a trip is planned, the first stop is "current" so the list invites you to start.
  const statusOf = (id: string): StopStatus =>
    plan ? j.statusOf(id) : id === landmarks[0]?.id ? 'current' : 'locked';
  const current = roadmap.find((l) => l.id === currentId);
  const skipped = plan?.skippedForAccessibility.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar progress={plan ? `${completedIds.length}/${plan.stopIds.length}` : undefined} xp={j.xp} />

      <ScrollView contentContainerStyle={styles.content}>
        <UnitBanner
          overline={
            plan ? fmt(s.roadmap.overline, { time: formatDuration(plan.totalMinutes) }) : s.roadmap.previewOverline
          }
          title={plan ? fmt(s.roadmap.title, { n: plan.stopIds.length }) : s.roadmap.previewTitle}
          actionLabel={plan ? `⚙️ ${s.roadmap.edit}` : undefined}
          onAction={openSetup}
        />

        {skipped > 0 ? (
          <View style={styles.notice} accessibilityRole="text">
            <DuoText style={styles.noticeIcon}>♿</DuoText>
            <DuoText variant="caption" color={t.textMuted} style={styles.noticeText}>
              {fmt(s.roadmap.skipped, { n: skipped })}
            </DuoText>
          </View>
        ) : null}

        {j.loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <DuoText variant="body" color={t.textMuted}>
              {s.roadmap.loading}
            </DuoText>
          </View>
        ) : j.error ? (
          <View style={styles.center}>
            <DuoText variant="heading">😕 {s.roadmap.loadError}</DuoText>
            <DuoText variant="caption" color={t.textMuted} style={styles.errorText}>
              {j.error}
            </DuoText>
            <DuoButton title={s.common.tryAgain} variant="secondary" size="md" onPress={j.reload} />
          </View>
        ) : (
          <Roadmap
            landmarks={roadmap}
            statusOf={statusOf}
            onPressStop={(lm) => (!plan && statusOf(lm.id) === 'current' ? openSetup() : openPlace(lm))}
          />
        )}

        {j.isFinished ? (
          <View style={styles.finish}>
            <DuoText style={styles.trophy}>🏆</DuoText>
            <DuoText variant="title" color={Brand.primary}>
              {s.roadmap.complete}
            </DuoText>
            <DuoText variant="body" color={t.textMuted} style={styles.errorText}>
              {fmt(s.roadmap.completeText, { n: completedIds.length, xp: j.xp })}
            </DuoText>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {!plan ? (
          <DuoButton title={s.roadmap.planTrip} onPress={openSetup} />
        ) : j.isFinished ? (
          <DuoButton
            title={s.roadmap.planAnother}
            onPress={() => {
              j.resetTrip();
              openSetup();
            }}
          />
        ) : current ? (
          <DuoButton
            title={completedIds.length === 0 ? s.roadmap.startRoute : s.roadmap.continueRoute}
            onPress={openMap}
          />
        ) : null}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: t.radius.md,
    backgroundColor: t.surface,
  },
  noticeIcon: { fontSize: 20, lineHeight: 26 },
  noticeText: { flex: 1 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  errorText: { textAlign: 'center' },
  finish: { alignItems: 'center', gap: 6, marginTop: 24 },
  trophy: { fontSize: 64, lineHeight: 76 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: t.background },
}));
