import { View } from 'react-native';

import type { LandmarkFact } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { themedStyles, useDuo } from '@/state/theme-context';

import { SectionCard } from './section-card';

export function FactsList({ facts }: { facts: LandmarkFact[] }) {
  const t = useDuo();
  const styles = useStyles();
  if (facts.length === 0) return null;
  return (
    <SectionCard title="Good to know" icon="💡">
      {facts.map((f) => (
        <View key={f.label} style={styles.row} accessibilityLabel={`${f.label}: ${f.value}`}>
          <View style={styles.iconBubble}>
            <DuoText style={styles.icon}>{f.icon}</DuoText>
          </View>
          <View style={styles.texts}>
            <DuoText variant="caption" color={t.textMuted}>
              {f.label}
            </DuoText>
            <DuoText variant="body">{f.value}</DuoText>
          </View>
        </View>
      ))}
    </SectionCard>
  );
}

const useStyles = themedStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22, lineHeight: 28 },
  texts: { flex: 1 },
}));
