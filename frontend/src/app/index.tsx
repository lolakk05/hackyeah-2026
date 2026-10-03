import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { Brand } from '@/constants/duo-theme';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo, useThemeMode } from '@/state/theme-context';

/** Start page: welcome, then GET STARTED (new trip) or CONTINUE (trip in progress). */
export default function WelcomeScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { toggle } = useThemeMode();
  const { plan, isFinished, completedIds } = useJourney();
  const inProgress = !!plan && !isFinished;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            tapFeedback();
            toggle();
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: t.dark }}
          accessibilityLabel="Night mode"
          hitSlop={10}>
          <View style={styles.modeButton}>
            <DuoText style={styles.modeIcon}>{t.dark ? '☀️' : '🌙'}</DuoText>
          </View>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.modelRing}>
          <LandmarkModel kind="castle" backgroundColor={Brand.green} interactive style={styles.model} />
        </View>
        <DuoText variant="hero" style={styles.center} accessibilityRole="header">
          Kraków Quest
        </DuoText>
        <DuoText variant="body" color={t.textMuted} style={styles.center}>
          Explore the Old Town one landmark at a time: a route made for your time and your accessibility needs, with a
          3D map to guide you.
        </DuoText>
      </View>

      <View style={styles.buttons}>
        {inProgress ? (
          <>
            <DuoButton
              title="Continue"
              subtitle={`${completedIds.length} of ${plan.stopIds.length} stops visited`}
              onPress={() => router.push('/roadmap')}
            />
            <DuoButton title="Plan a new trip" variant="white" size="md" onPress={() => router.push('/setup')} />
          </>
        ) : (
          <DuoButton
            title="Get started"
            subtitle="Choose trip length & accessibility"
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
  modeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: { fontSize: 22, lineHeight: 28 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, maxWidth: 520, alignSelf: 'center' },
  modelRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: t.soft(Brand.green, 0.5),
    marginBottom: 8,
  },
  model: { flex: 1 },
  center: { textAlign: 'center' },
  buttons: { gap: 12, paddingBottom: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
}));
