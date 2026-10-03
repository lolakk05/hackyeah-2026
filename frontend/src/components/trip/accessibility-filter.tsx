import { Pressable, View } from 'react-native';

import type { AccessibilityNeeds } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';

const OPTIONS: { key: keyof AccessibilityNeeds; icon: string; title: string; hint: string }[] = [
  { key: 'wheelchair', icon: '♿', title: 'Wheelchair user', hint: 'Only places a wheelchair can reach' },
  { key: 'reducedMobility', icon: '🚶', title: 'No stairs, please', hint: 'Step-free places and a slower walking pace' },
  { key: 'lowVision', icon: '🦯', title: 'Blind / low vision', hint: 'Shows audio guides and audio descriptions' },
  { key: 'hearing', icon: '👂', title: 'Deaf / hard of hearing', hint: 'Shows hearing loops and written guides' },
];

/** Big tappable cards to choose accessibility needs. */
export function AccessibilityFilter({
  value,
  onChange,
}: {
  value: AccessibilityNeeds;
  onChange: (next: AccessibilityNeeds) => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  return (
    <View style={styles.list}>
      <DuoText variant="label" color={t.textMuted}>
        ♿  ACCESSIBILITY
      </DuoText>
      {OPTIONS.map((opt) => {
        const selected = value[opt.key];
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              tapFeedback();
              onChange({ ...value, [opt.key]: !selected });
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.title}
            accessibilityHint={opt.hint}>
            {({ pressed }) => (
              <View
                style={[
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && { borderBottomWidth: 2, marginTop: 3 },
                ]}>
                <View style={[styles.iconBubble, selected && { backgroundColor: Brand.blue }]}>
                  <DuoText style={styles.icon}>{opt.icon}</DuoText>
                </View>
                <View style={styles.texts}>
                  <DuoText variant="heading" color={selected ? t.blueText : t.text} style={styles.optionTitle}>
                    {opt.title}
                  </DuoText>
                  <DuoText variant="caption" color={t.textMuted}>
                    {opt.hint}
                  </DuoText>
                </View>
                <View style={[styles.check, selected && styles.checkOn]}>
                  {selected ? (
                    <DuoText variant="label" color={Brand.onColor}>
                      ✓
                    </DuoText>
                  ) : null}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  list: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    minHeight: 76,
    borderRadius: t.radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: t.border,
    backgroundColor: t.card,
  },
  optionSelected: { borderColor: Brand.blue, backgroundColor: t.soft(Brand.blue) },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24, lineHeight: 30 },
  texts: { flex: 1 },
  optionTitle: { fontSize: 18 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Brand.blue, borderColor: Brand.blue },
}));
