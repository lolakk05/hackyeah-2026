import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { formatCoins } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { themedStyles } from '@/state/theme-context';

/** Top bar: city, trip progress and coins (tap → profile, where XP and level are). */
export function TopBar({ progress }: { progress?: string }) {
  const styles = useStyles();
  const { s, lang } = useI18n();
  const { user } = useAccount();
  const coins = formatCoins(user?.coins ?? 0, lang);

  return (
    <View style={styles.bar}>
      <DuoText variant="heading" accessibilityRole="header">
        {s.common.city}
      </DuoText>
      <View style={styles.right}>
        {progress ? (
          <View style={styles.pill} accessibilityLabel={progress}>
            <DuoText style={styles.icon}>📍</DuoText>
            <DuoText variant="caption" style={styles.pillText}>
              {progress}
            </DuoText>
          </View>
        ) : null}
        <Pressable
          onPress={() => {
            tapFeedback();
            router.push('/profile');
          }}
          accessibilityRole="button"
          accessibilityLabel={`${coins} ${s.common.coins}. ${s.profile.open}`}
          hitSlop={6}
          style={styles.right}>
          <View style={styles.pill}>
            <DuoText variant="caption" style={styles.pillText}>
              🪙 {coins}
            </DuoText>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  right: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.card,
  },
  xpPill: { backgroundColor: t.soft(Brand.primary, 0.82) },
  icon: { fontSize: 15, lineHeight: 20 },
  pillText: { fontWeight: '700' },
}));
