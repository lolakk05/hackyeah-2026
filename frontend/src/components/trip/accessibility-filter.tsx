import { Pressable, View } from 'react-native';

import type { AccessibilityNeeds } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

const OPTIONS: { key: keyof AccessibilityNeeds; icon: string }[] = [
  { key: 'wheelchair', icon: '♿' },
  { key: 'reducedMobility', icon: '🚶' },
  { key: 'lowVision', icon: '🦯' },
  { key: 'hearing', icon: '👂' },
];

/** Big tappable rows to choose accessibility needs. */
export function AccessibilityFilter({
  value,
  onChange,
}: {
  value: AccessibilityNeeds;
  onChange: (next: AccessibilityNeeds) => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s } = useI18n();
  return (
    <View style={styles.list}>
      <DuoText variant="label" color={t.textMuted}>
        {s.setup.accessibility}
      </DuoText>
      {OPTIONS.map((opt) => {
        const selected = value[opt.key];
        const text = s.setup.options[opt.key];
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              tapFeedback();
              onChange({ ...value, [opt.key]: !selected });
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={text.title}
            accessibilityHint={text.hint}>
            {({ pressed }) => (
              <View style={[styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
                <View style={[styles.iconBubble, selected && styles.iconBubbleSelected]}>
                  <DuoText style={styles.icon}>{opt.icon}</DuoText>
                </View>
                <View style={styles.texts}>
                  <DuoText variant="heading" style={styles.optionTitle}>
                    {text.title}
                  </DuoText>
                  <DuoText variant="caption" color={t.textMuted}>
                    {text.hint}
                  </DuoText>
                </View>
                <View style={[styles.toggle, selected && styles.toggleOn]}>
                  <View style={[styles.knob, selected && styles.knobOn]} />
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
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    minHeight: 76,
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: t.card,
  },
  optionSelected: { borderColor: Brand.primary, backgroundColor: t.soft(Brand.primary, 0.88) },
  optionPressed: { opacity: 0.85 },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: t.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleSelected: { backgroundColor: t.soft(Brand.primary, 0.6) },
  icon: { fontSize: 24, lineHeight: 30 },
  texts: { flex: 1 },
  optionTitle: { fontSize: 17 },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: t.locked,
    padding: 3,
  },
  toggleOn: { backgroundColor: Brand.primary },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.textMuted },
  knobOn: { backgroundColor: Brand.onPrimary, transform: [{ translateX: 20 }] },
}));
