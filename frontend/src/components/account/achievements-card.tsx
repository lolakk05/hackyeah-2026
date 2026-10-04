import { View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { Brand } from '@/constants/duo-theme';
import { ACHIEVEMENTS } from '@/game/achievements';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Profile section: all achievements as badges with progress. */
export function AchievementsCard() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { stats, level } = useAccount();
  const items = ACHIEVEMENTS.map((a) => {
    const value = Math.min(a.value(stats, level.level), a.target);
    return { ...a, value, done: value >= a.target };
  });
  const done = items.filter((i) => i.done).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <DuoText variant="heading" style={styles.flex}>
          🏆 {s.achievements.title}
        </DuoText>
        <DuoText variant="caption" color={Brand.primary} style={styles.bold}>
          {fmt(s.achievements.count, { n: done, total: items.length })}
        </DuoText>
      </View>
      <DuoText variant="caption" color={t.textMuted}>
        {fmt(s.achievements.stats, {
          trips: stats.trips,
          km: (stats.meters / 1000).toFixed(1),
          places: stats.places.length,
        })}
      </DuoText>
      <View style={styles.grid}>
        {items.map((a) => {
          const text = s.achievements.items[a.id];
          return (
            <View
              key={a.id}
              style={[styles.badge, a.done && styles.badgeDone]}
              accessibilityLabel={`${text.name}. ${text.desc}. ${fmt(s.achievements.progress, { n: a.value, target: a.target })}`}>
              <View style={[styles.icon, a.done ? styles.iconDone : styles.iconLocked]}>
                <DuoText style={[styles.emoji, !a.done && styles.dim]}>{a.icon}</DuoText>
              </View>
              <DuoText variant="caption" style={styles.bold} numberOfLines={1}>
                {text.name}
              </DuoText>
              <DuoText variant="caption" color={t.textMuted} numberOfLines={2} style={styles.desc}>
                {text.desc}
              </DuoText>
              {a.done ? (
                <DuoText variant="caption" color={Brand.success} style={styles.bold}>
                  ✓
                </DuoText>
              ) : (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(a.value / a.target) * 100}%` }]} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  card: { padding: 16, gap: 12, borderRadius: t.radius.xl, backgroundColor: t.surface },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    padding: 10,
    borderRadius: t.radius.lg,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  badgeDone: { borderColor: t.soft(Brand.primary, 0.4) },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: t.soft(Brand.primary, 0.7) },
  iconLocked: { backgroundColor: t.locked },
  emoji: { fontSize: 24, lineHeight: 30 },
  dim: { opacity: 0.35 },
  desc: { textAlign: 'center', fontSize: 12, lineHeight: 15 },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: t.locked, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', backgroundColor: Brand.primary },
}));
