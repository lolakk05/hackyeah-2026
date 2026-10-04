import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { formatCoins } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Level title for a level number (the last title repeats for higher levels). */
export function useLevelTitle() {
  const { s } = useI18n();
  return (level: number) => s.levels[Math.min(level, s.levels.length) - 1];
}

/** The user's level, progress to the next level and coins. */
export function LevelCard({ onPress }: { onPress?: () => void }) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const { user, level } = useAccount();
  const title = useLevelTitle();
  if (!user) return null;

  const label = `${fmt(s.profile.level, { n: level.level })}, ${title(level.level)}. ${fmt(s.profile.xpToNext, {
    n: level.xpToNext,
    level: level.level + 1,
  })}. ${formatCoins(user.coins, lang)} ${s.common.coins}`;

  const body = (pressed: boolean) => (
    <View style={[styles.card, pressed && styles.pressed]}>
      <View style={styles.badge}>
        <DuoText style={styles.badgeNumber} color={Brand.onPrimary}>
          {level.level}
        </DuoText>
      </View>
      <View style={styles.middle}>
        <DuoText variant="heading" numberOfLines={1}>
          {fmt(s.profile.level, { n: level.level })} · {title(level.level)}
        </DuoText>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(4, level.progress * 100)}%` }]} />
        </View>
        <DuoText variant="caption" color={t.textMuted}>
          {fmt(s.profile.xpToNext, { n: level.xpToNext, level: level.level + 1 })}
        </DuoText>
      </View>
      <View style={styles.coins}>
        <DuoText style={styles.coinIcon}>🪙</DuoText>
        <DuoText variant="heading" color={Brand.primary}>
          {formatCoins(user.coins, lang)}
        </DuoText>
      </View>
    </View>
  );

  if (!onPress) return <View accessibilityLabel={label}>{body(false)}</View>;
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: t.radius.xl,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  pressed: { backgroundColor: t.cardRaised },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  badgeNumber: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  middle: { flex: 1, gap: 6 },
  track: { height: 10, borderRadius: 5, backgroundColor: t.locked, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: Brand.primary },
  coins: { alignItems: 'center', minWidth: 52 },
  coinIcon: { fontSize: 22, lineHeight: 28 },
}));
