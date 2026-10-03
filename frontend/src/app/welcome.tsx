import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { LandmarkModel } from '@/components/models/landmark-model';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Start page: GET STARTED (new trip) or CONTINUE (trip in progress). */
export default function WelcomeScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const { plan, isFinished, completedIds } = useJourney();
  const inProgress = !!plan && !isFinished;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={s.language.change}
          hitSlop={10}
          style={styles.langChip}>
          <DuoText variant="caption" style={styles.langText}>
            {lang === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN'}
          </DuoText>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.modelTile}>
          <LandmarkModel kind="castle" backgroundColor={t.cardRaised} interactive style={styles.model} />
        </View>
        <DuoText variant="hero" style={styles.center} accessibilityRole="header">
          {s.appName}
        </DuoText>
        <DuoText variant="body" color={t.textMuted} style={styles.center}>
          {s.welcome.text}
        </DuoText>
      </View>

      <View style={styles.buttons}>
        {inProgress ? (
          <>
            <DuoButton
              title={s.welcome.continue}
              subtitle={fmt(s.welcome.continueSub, { done: completedIds.length, total: plan.stopIds.length })}
              onPress={() => router.push('/roadmap')}
            />
            <DuoButton title={s.welcome.newTrip} variant="secondary" size="md" onPress={() => router.push('/setup')} />
          </>
        ) : (
          <DuoButton
            title={s.welcome.getStarted}
            subtitle={s.welcome.getStartedSub}
            onPress={() => router.push('/setup')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background, paddingHorizontal: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 8 },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card },
  langText: { fontWeight: '700' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, maxWidth: 520, alignSelf: 'center' },
  modelTile: {
    width: 230,
    height: 230,
    borderRadius: 56,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: t.soft(Brand.primary, 0.55),
    marginBottom: 12,
  },
  model: { flex: 1 },
  center: { textAlign: 'center' },
  buttons: { gap: 12, paddingBottom: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
}));
