import { router } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Landmark } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { TopBar } from '@/components/home/top-bar';
import { Pinek } from '@/components/pinek';
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
  const route = plan?.route;
  const walkMinutesTo = route ? Object.fromEntries(route.legs.map((l) => [l.toId, l.durationMinutes])) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar progress={plan ? `${completedIds.length}/${plan.stopIds.length}` : undefined} />

      <ScrollView contentContainerStyle={styles.content}>
        <UnitBanner
          overline={
            plan
              ? fmt(s.roadmap.overline, { time: formatDuration(route?.walkMinutes ?? plan.totalMinutes) })
              : s.roadmap.previewOverline
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

        {route ? (
          <View style={styles.routeCard} accessibilityRole="summary">
            <DuoText variant="heading">
              {fmt(s.roadmap.walkSummary, {
                km: (route.distanceMeters / 1000).toFixed(1),
                min: route.walkMinutes,
              })}
            </DuoText>
            <DuoText variant="caption" color={t.textMuted}>
              {s.setup.walkOnlyNote}
            </DuoText>
            {!route.matchesTarget ? (
              <DuoText variant="caption" color={Brand.primary}>
                {s.roadmap.shorter}
              </DuoText>
            ) : null}
            {route.warnings.map((w) => (
              <DuoText key={w} variant="caption" color={t.textMuted}>
                ⓘ {w}
              </DuoText>
            ))}
            {route.attribution ? (
              <View style={styles.attribution}>
                <DuoText variant="caption" color={t.lockedText} style={styles.flex}>
                  {route.attribution}
                </DuoText>
                <Pressable
                  onPress={() => Linking.openURL('https://www.openstreetmap.org/fixthemap')}
                  accessibilityRole="link"
                  hitSlop={8}>
                  <DuoText variant="caption" color={Brand.primary}>
                    {s.roadmap.fixMap}
                  </DuoText>
                </Pressable>
              </View>
            ) : null}
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
            walkMinutesTo={walkMinutesTo}
            onPressStop={(lm) => (!plan && statusOf(lm.id) === 'current' ? openSetup() : openPlace(lm))}
          />
        )}

        {j.isFinished ? (
          <View style={styles.finish}>
            <Pinek pose="cheer" size={150} bounce />
            <DuoText variant="title" color={Brand.primary}>
              {s.roadmap.complete}
            </DuoText>
            <DuoText variant="body" color={t.textMuted} style={styles.errorText}>
              {fmt(s.roadmap.completeText, { n: completedIds.length, xp: j.tripXp })}
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
  routeCard: { padding: 16, gap: 6, borderRadius: t.radius.lg, backgroundColor: t.surface },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  errorText: { textAlign: 'center' },
  finish: { alignItems: 'center', gap: 6, marginTop: 24 },
  trophy: { fontSize: 64, lineHeight: 76 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: t.background },
}));
