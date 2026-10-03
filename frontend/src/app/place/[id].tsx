import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { successFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { AccessibilityCard } from '@/components/place/accessibility-card';
import { AskAiChat } from '@/components/place/ask-ai-chat';
import { FactsList } from '@/components/place/facts-list';
import { PhotoCarousel } from '@/components/place/photo-carousel';
import { SectionCard } from '@/components/place/section-card';
import { Brand, formatDuration, shade } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';
import { useLandmark } from '@/hooks/use-landmark';
import { useJourney } from '@/state/journey-context';

/** Landmark page: 3D model, photos, text, accessibility info, facts and the AI guide. */
export default function PlaceScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { landmark, loading, error } = useLandmark(id);
  const j = useJourney();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/roadmap'));

  if (!landmark) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {loading ? (
          <ActivityIndicator size="large" color={Brand.green} />
        ) : (
          <>
            <DuoText variant="heading">😕 {error ?? 'Place not found'}</DuoText>
            <DuoButton title="Back to map" variant="blue" size="md" onPress={close} />
          </>
        )}
      </SafeAreaView>
    );
  }

  const status = j.plan ? j.statusOf(landmark.id) : null;
  const stopNumber = j.plan ? j.plan.stopIds.indexOf(landmark.id) + 1 : 0;

  const markVisited = () => {
    j.completeStop(landmark.id);
    successFeedback();
    close();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Back to map" hitSlop={12}>
          <DuoText variant="title" color={t.lockedText}>
            ✕
          </DuoText>
        </Pressable>
        {stopNumber > 0 && j.plan ? (
          <View style={styles.progressTrack} accessibilityLabel={`Stop ${stopNumber} of ${j.plan.stopIds.length}`}>
            <View
              style={[
                styles.progressFill,
                { width: `${(j.completedIds.length / j.plan.stopIds.length) * 100}%` },
              ]}
            />
          </View>
        ) : (
          <View style={styles.flex} />
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: landmark.color, borderBottomColor: shade(landmark.color, 0.2) }]}>
            <LandmarkModel
              kind={landmark.model}
              backgroundColor={landmark.color}
              interactive
              style={styles.heroModel}
            />
            <View style={styles.heroHint} pointerEvents="none">
              <DuoText variant="caption" color={Brand.onColor}>
                👆 Drag to spin
              </DuoText>
            </View>
          </View>

          <View style={styles.titleBlock}>
            {stopNumber > 0 ? (
              <DuoText variant="label" color={landmark.color}>
                STOP {stopNumber}
              </DuoText>
            ) : null}
            <DuoText variant="hero" accessibilityRole="header">
              {landmark.name}
            </DuoText>
            <DuoText variant="body" color={t.textMuted}>
              {landmark.tagline}
            </DuoText>
            <View style={styles.chips}>
              <Chip text={`⏱ ${formatDuration(landmark.visitMinutes)} visit`} />
              {landmark.walkMinutesFromPrevious > 0 ? (
                <Chip text={`🚶 ${landmark.walkMinutesFromPrevious} min walk`} />
              ) : null}
              {status === 'completed' ? <Chip text="✅ Visited" /> : null}
            </View>
          </View>

          <PhotoCarousel photos={landmark.photos} name={landmark.name} color={landmark.color} />

          <SectionCard title="About" icon="📖">
            <DuoText variant="body">{landmark.description}</DuoText>
          </SectionCard>

          <AccessibilityCard info={landmark.accessibility} needs={j.preferences.needs} />

          <FactsList facts={landmark.facts} />

          <AskAiChat landmark={landmark} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {status === 'current' ? (
          <DuoButton title="I'm here! Mark as visited" subtitle="+50 XP" onPress={markVisited} />
        ) : status === 'completed' ? (
          <DuoButton title="Back to map" variant="white" onPress={close} />
        ) : status === 'locked' ? (
          <DuoButton title="Back to map" subtitle="Visit the earlier stops first" variant="white" onPress={close} />
        ) : (
          <DuoButton title="Plan a trip" variant="blue" onPress={() => router.replace('/setup')} />
        )}
      </View>
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
  progressTrack: { flex: 1, height: 16, borderRadius: 8, backgroundColor: t.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8, backgroundColor: Brand.green },
  content: { padding: 20, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  hero: { height: 280, borderRadius: t.radius.xl, borderBottomWidth: 8, overflow: 'hidden' },
  heroModel: { flex: 1 },
  heroHint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  titleBlock: { gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.border,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 2,
    borderTopColor: t.border,
    backgroundColor: t.card,
  },
}));
