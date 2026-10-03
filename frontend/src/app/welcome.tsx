import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelCard } from '@/components/account/level-card';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Start page: level & coins, ranking/rewards, and GET STARTED or CONTINUE. */
export default function WelcomeScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const { status, user } = useAccount();
  const { plan, isFinished, completedIds } = useJourney();
  const inProgress = !!plan && !isFinished;

  if (status === 'signedOut') return <Redirect href="/login" />;

  const openProfile = () => router.push('/profile');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={s.profile.open}
          hitSlop={8}
          style={styles.profileChip}>
          <View style={styles.avatar}>
            <DuoText variant="caption" color={Brand.onPrimary} style={styles.bold}>
              {user?.username.slice(0, 1).toUpperCase() ?? '?'}
            </DuoText>
          </View>
          <DuoText variant="caption" style={styles.bold} numberOfLines={1}>
            {user?.username}
          </DuoText>
        </Pressable>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel={s.language.change}
          hitSlop={10}
          style={styles.langChip}>
          <DuoText variant="caption" style={styles.bold}>
            {lang === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN'}
          </DuoText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        <View style={styles.stats}>
          <LevelCard onPress={openProfile} />
          <View style={styles.row}>
            <Tile icon="🏆" label={s.profile.ranking} onPress={() => router.push('/ranking')} />
            <Tile icon="🎟️" label={s.profile.rewards} onPress={() => router.push('/rewards')} />
            <Tile icon="⚠️" label={s.issues.title} onPress={() => router.push('/reports')} />
          </View>
        </View>
      </ScrollView>

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

/** Square quick-action button (icon above a short label). */
function Tile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.flex}>
      {({ pressed }) => (
        <View style={[styles.tile, pressed && styles.tilePressed]}>
          <DuoText style={styles.tileIcon}>{icon}</DuoText>
          <DuoText variant="caption" style={styles.bold} numberOfLines={1}>
            {label}
          </DuoText>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background, paddingHorizontal: 20 },
  tile: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: t.radius.lg,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  tilePressed: { backgroundColor: t.cardRaised },
  tileIcon: { fontSize: 26, lineHeight: 32 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 8 },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.card,
    maxWidth: '65%',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card },
  bold: { fontWeight: '700' },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: 20, paddingVertical: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 12 },
  modelTile: {
    width: 180,
    height: 180,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: t.soft(Brand.primary, 0.55),
    marginBottom: 6,
  },
  model: { flex: 1 },
  center: { textAlign: 'center' },
  stats: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  buttons: { gap: 12, paddingTop: 8, paddingBottom: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
}));
