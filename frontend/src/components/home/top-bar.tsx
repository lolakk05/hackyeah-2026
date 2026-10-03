import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { themedStyles, useThemeMode } from '@/state/theme-context';

export interface Stat {
  icon: string;
  value: string;
  color: string;
  a11y: string;
}

/** Top stats row (city, time, stops, XP) plus the night-mode switch. */
export function TopBar({ city, stats }: { city: string; stats: Stat[] }) {
  const styles = useStyles();
  const { theme, toggle } = useThemeMode();

  return (
    <View style={styles.bar}>
      <View style={styles.city} accessibilityLabel={`City: ${city}`}>
        <DuoText style={styles.icon}>🏰</DuoText>
        <DuoText variant="label">{city}</DuoText>
      </View>
      {stats.map((s) => (
        <View key={s.a11y} style={styles.stat} accessibilityLabel={s.a11y}>
          <DuoText style={styles.icon}>{s.icon}</DuoText>
          <DuoText variant="label" color={s.color}>
            {s.value}
          </DuoText>
        </View>
      ))}
      <Pressable
        onPress={() => {
          tapFeedback();
          toggle();
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: theme.dark }}
        accessibilityLabel="Night mode"
        hitSlop={8}>
        {({ pressed }) => (
          <View style={[styles.modeButton, pressed && styles.modeButtonPressed]}>
            <DuoText style={styles.icon}>{theme.dark ? '☀️' : '🌙'}</DuoText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: t.border,
    backgroundColor: t.background,
  },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.border,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { fontSize: 20, lineHeight: 26 },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonPressed: { borderBottomWidth: 2, marginTop: 2 },
}));
