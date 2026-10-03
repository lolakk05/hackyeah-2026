import { View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { themedStyles } from '@/state/theme-context';

/** Top bar: city, trip progress and experience points. */
export function TopBar({ progress, xp }: { progress?: string; xp: number }) {
  const styles = useStyles();
  const { s } = useI18n();

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
        <View style={[styles.pill, styles.xpPill]} accessibilityLabel={`${xp} ${s.common.xp}`}>
          <DuoText style={styles.icon}>⭐</DuoText>
          <DuoText variant="caption" color={Brand.primary} style={styles.pillText}>
            {xp} {s.common.xp}
          </DuoText>
        </View>
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
  },
  right: { flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.card,
  },
  xpPill: { backgroundColor: t.soft(Brand.primary, 0.82) },
  icon: { fontSize: 15, lineHeight: 20 },
  pillText: { fontWeight: '700' },
}));
