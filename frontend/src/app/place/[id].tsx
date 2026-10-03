import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { REPORT_QUESTION_CHANCE } from '@/api/config';
import type { ReportCategory } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { arriveFeedback, celebrateFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { AccessibilityCard } from '@/components/place/accessibility-card';
import { AskAiChat } from '@/components/place/ask-ai-chat';
import { FactsList } from '@/components/place/facts-list';
import { PhotoCarousel } from '@/components/place/photo-carousel';
import { RewardBurst } from '@/components/account/reward-burst';
import { pickReportCategory, ReportQuestion } from '@/components/place/report-question';
import { ReportSheet } from '@/components/reports/report-sheet';
import { SectionCard } from '@/components/place/section-card';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { formatCoins, levelInfo } from '@/game/progression';
import { useLandmark } from '@/hooks/use-landmark';
import { useI18n } from '@/i18n/language-context';
import { useJourney, type StopReward } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Landmark page: 3D model, photos, text, accessibility info, facts and the AI guide. */
export default function PlaceScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { landmark, loading, error } = useLandmark(id);
  const j = useJourney();

  const [completing, setCompleting] = useState(false);
  const [report, setReport] = useState<ReportCategory | null>(null);
  const [burst, setBurst] = useState<StopReward | null>(null);
  const [reporting, setReporting] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/roadmap'));

  if (!landmark) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {loading ? (
          <ActivityIndicator size="large" color={Brand.primary} />
        ) : (
          <>
            <DuoText variant="heading">😕 {error ?? s.place.notFound}</DuoText>
            <DuoButton title={s.place.backToMap} variant="secondary" size="md" onPress={close} />
          </>
        )}
      </SafeAreaView>
    );
  }

  const status = j.plan ? j.statusOf(landmark.id) : null;
  const stopNumber = j.plan ? j.plan.stopIds.indexOf(landmark.id) + 1 : 0;

  // Arrived: earn XP (and the route bonus after the last stop), then
  // (sometimes) ask one yes/no accessibility question about the way here.
  const markVisited = async () => {
    setCompleting(true);
    const reward = await j.completeStop(landmark.id);
    if (reward.route) celebrateFeedback(); // whole trip done!
    else arriveFeedback();
    setCompleting(false);
    // Only a level-up gets a celebration; otherwise carry straight on.
    const last = reward.route ?? reward.visit;
    const gained = reward.visit.xp + (reward.route?.xp ?? 0);
    const levelUp =
      last.totalXp !== undefined && levelInfo(last.totalXp).level > levelInfo(last.totalXp - gained).level;
    if (levelUp) setBurst(reward);
    else afterBurst();
  };

  // After the celebration: sometimes one yes/no accessibility question, else back to the map.
  const afterBurst = () => {
    setBurst(null);
    // iOS can't open a new modal while the previous one is still closing: wait a moment.
    if (Math.random() < REPORT_QUESTION_CHANCE) setTimeout(() => setReport(pickReportCategory(j.preferences.needs)), 450);
    else close();
  };

  const stopIndex = j.plan ? j.plan.stopIds.indexOf(landmark.id) : -1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={s.common.back} hitSlop={12}>
          <DuoText variant="title" color={t.textMuted}>
            ←
          </DuoText>
        </Pressable>
        {stopNumber > 0 && j.plan ? (
          <View
            style={styles.progressTrack}
            accessibilityLabel={fmt(s.map.stopOf, { n: stopNumber, total: j.plan.stopIds.length })}>
            <View
              style={[styles.progressFill, { width: `${(j.completedIds.length / j.plan.stopIds.length) * 100}%` }]}
            />
          </View>
        ) : (
          <View style={styles.flex} />
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: landmark.color }]}>
            <LandmarkModel kind={landmark.model} backgroundColor={landmark.color} interactive style={styles.heroModel} />
            <View style={styles.heroHint} pointerEvents="none">
              <DuoText variant="caption" color={Brand.onColor}>
                {s.place.dragToSpin}
              </DuoText>
            </View>
          </View>

          <View style={styles.titleBlock}>
            {stopNumber > 0 ? (
              <DuoText variant="label" color={Brand.primary}>
                {fmt(s.place.stop, { n: stopNumber })}
              </DuoText>
            ) : null}
            <DuoText variant="hero" accessibilityRole="header">
              {landmark.name}
            </DuoText>
            <DuoText variant="body" color={t.textMuted}>
              {landmark.tagline}
            </DuoText>
            <View style={styles.chips}>
              <Chip text={fmt(s.place.visit, { time: formatDuration(landmark.visitMinutes) })} />
              {status === 'completed' ? <Chip text={s.place.visited} /> : null}
            </View>
          </View>

          <PhotoCarousel photos={landmark.photos} name={landmark.name} color={landmark.color} />

          <SectionCard title={s.place.about} icon="📖">
            <DuoText variant="body">{landmark.description}</DuoText>
          </SectionCard>

          <AskAiChat landmark={landmark} />

          <AccessibilityCard info={landmark.accessibility} needs={j.preferences.needs} />

          <FactsList facts={landmark.facts} />

          <DuoButton
            title={`⚠️ ${s.issues.reportHere}`}
            variant="secondary"
            size="md"
            onPress={() => setReporting(true)}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {status === 'current' ? (
          <DuoButton title={s.place.markVisited} onPress={markVisited} loading={completing} />
        ) : status === 'locked' ? (
          <DuoButton title={s.place.backToMap} subtitle={s.place.visitEarlier} variant="secondary" onPress={close} />
        ) : status === 'completed' ? (
          <DuoButton title={s.place.backToMap} variant="secondary" onPress={close} />
        ) : (
          <DuoButton title={s.place.planTrip} onPress={() => router.replace('/setup')} />
        )}
      </View>

      {burst ? (
        <RewardBurst
          awards={burst.route ? [burst.visit, burst.route] : [burst.visit]}
          bonusLabel={
            burst.route
              ? fmt(s.place.routeBonus, { n: burst.route.xp, coins: formatCoins(burst.route.coins, lang) })
              : undefined
          }
          onClose={afterBurst}
        />
      ) : null}

      {reporting ? (
        <ReportSheet
          place={{
            location: landmark.coordinates,
            locationSource: 'landmark',
            landmarkId: landmark.id,
            landmarkName: landmark.name,
            segment:
              j.plan && stopIndex >= 0
                ? { fromStopId: stopIndex > 0 ? j.plan.stopIds[stopIndex - 1] : null, toStopId: landmark.id }
                : undefined,
            label: landmark.name,
          }}
          onClose={() => setReporting(false)}
        />
      ) : null}

      {report ? (
        <ReportQuestion
          visible
          category={report}
          onAnswer={(accessible) => j.reportLeg(landmark.id, report, accessible)}
          onDone={() => {
            setReport(null);
            close();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Chip({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.chip}>
      <DuoText variant="caption">{text}</DuoText>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 8 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: t.card, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: Brand.primary },
  content: { padding: 20, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  hero: { height: 280, borderRadius: t.radius.xl, overflow: 'hidden' },
  heroModel: { flex: 1 },
  heroHint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  titleBlock: { gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.card,
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: t.background },
  earned: { minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
}));
