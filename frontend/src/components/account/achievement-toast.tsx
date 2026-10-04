import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuoText } from '@/components/duo/duo-text';
import { celebrateFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { ACHIEVEMENTS } from '@/game/achievements';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { themedStyles } from '@/state/theme-context';

/** Small banner at the top of the screen when an achievement is unlocked. */
export function AchievementToast() {
  const styles = useStyles();
  const { s } = useI18n();
  const { newAchievements, dismissAchievement } = useAccount();
  const id = newAchievements[0];

  useEffect(() => {
    if (!id) return;
    celebrateFeedback();
    const timer = setTimeout(dismissAchievement, 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, newAchievements.length]);

  if (!id) return null;
  const a = ACHIEVEMENTS.find((x) => x.id === id)!;
  const text = s.achievements.items[id];
  return (
    <SafeAreaView edges={['top']} style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={dismissAchievement} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <View style={styles.toast}>
          <DuoText style={styles.icon}>{a.icon}</DuoText>
          <View style={styles.texts}>
            <DuoText variant="label" color={Brand.onPrimary}>
              {s.achievements.unlocked}
            </DuoText>
            <DuoText variant="heading" color={Brand.onPrimary} numberOfLines={1}>
              {text.name}
            </DuoText>
          </View>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: t.radius.xl,
    backgroundColor: Brand.primary,
    maxWidth: 480,
  },
  icon: { fontSize: 30, lineHeight: 36 },
  texts: { flexShrink: 1 },
}));
