import Slider from '@react-native-community/slider';
import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { selectionFeedback, tapFeedback } from '@/components/duo/haptics';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

export const MIN_TRIP = 30;
/** Up to 6 hours (the Route Finder backend accepts up to 360 minutes). */
export const MAX_TRIP = 360;
const STEP = 30;

/** Trip length picker: a slider from 30 min to 6 h, plus big − / + buttons. */
export function TripLengthSlider({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const t = useDuo();
  const styles = useStyles();
  const { s } = useI18n();
  const set = (v: number) => onChange(Math.min(MAX_TRIP, Math.max(MIN_TRIP, v)));

  return (
    <View style={styles.card}>
      <DuoText variant="label" color={t.textMuted}>
        {s.setup.tripLength}
      </DuoText>

      <View style={styles.valueRow}>
        <RoundButton label="−" onPress={() => set(value - STEP)} disabled={value <= MIN_TRIP} a11y={s.setup.shorter} />
        <View style={styles.valueBubble} accessibilityLiveRegion="polite">
          <DuoText variant="hero" color={Brand.primary}>
            {formatDuration(value)}
          </DuoText>
        </View>
        <RoundButton label="+" onPress={() => set(value + STEP)} disabled={value >= MAX_TRIP} a11y={s.setup.longer} />
      </View>

      <Slider
        style={styles.slider}
        minimumValue={MIN_TRIP}
        maximumValue={MAX_TRIP}
        step={STEP}
        value={value}
        onValueChange={(v) => {
          const next = Math.round(v);
          if (next !== value) selectionFeedback();
          set(next);
        }}
        minimumTrackTintColor={Brand.primary}
        maximumTrackTintColor={t.border}
        thumbTintColor={Brand.primary}
        accessibilityLabel={s.setup.tripLength}
      />
      <View style={styles.scale}>
        <DuoText variant="caption" color={t.textMuted}>
          30 min
        </DuoText>
        <DuoText variant="caption" color={t.textMuted}>
          {formatDuration(MAX_TRIP)}
        </DuoText>
      </View>
    </View>
  );
}

function RoundButton({
  label,
  onPress,
  disabled,
  a11y,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  a11y: string;
}) {
  const t = useDuo();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}>
      {({ pressed }) => (
        <View style={[styles.round, pressed && styles.roundPressed, disabled && styles.roundDisabled]}>
          <DuoText variant="title" color={disabled ? t.lockedText : t.text}>
            {label}
          </DuoText>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  card: {
    borderRadius: t.radius.xl,
    padding: 20,
    gap: 8,
    backgroundColor: t.card,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valueBubble: { flex: 1, alignItems: 'center' },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPressed: { backgroundColor: t.border },
  roundDisabled: { backgroundColor: t.locked },
  slider: { width: '100%', height: 48, marginTop: 6 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
}));
