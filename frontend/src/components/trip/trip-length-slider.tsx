import Slider from '@react-native-community/slider';
import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';

export const MIN_TRIP = 30;
export const MAX_TRIP = 360;
const STEP = 30;

/** Trip length picker: a slider from 30 min to 6 h, plus big − / + buttons. */
export function TripLengthSlider({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const t = useDuo();
  const styles = useStyles();
  const set = (v: number) => onChange(Math.min(MAX_TRIP, Math.max(MIN_TRIP, v)));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <DuoText variant="label" color={t.textMuted}>
          ⏱  TRIP LENGTH
        </DuoText>
      </View>

      <View style={styles.valueRow}>
        <RoundButton label="−" onPress={() => set(value - STEP)} disabled={value <= MIN_TRIP} a11y="Shorter trip" />
        <View style={styles.valueBubble} accessibilityLiveRegion="polite">
          <DuoText variant="hero" color={Brand.blue}>
            {formatDuration(value)}
          </DuoText>
        </View>
        <RoundButton label="+" onPress={() => set(value + STEP)} disabled={value >= MAX_TRIP} a11y="Longer trip" />
      </View>

      <Slider
        style={styles.slider}
        minimumValue={MIN_TRIP}
        maximumValue={MAX_TRIP}
        step={STEP}
        value={value}
        onValueChange={(v) => set(Math.round(v))}
        minimumTrackTintColor={Brand.blue}
        maximumTrackTintColor={t.border}
        thumbTintColor={Brand.blue}
        accessibilityLabel="Trip length"
      />
      <View style={styles.scale}>
        <DuoText variant="caption" color={t.textMuted}>
          30 min
        </DuoText>
        <DuoText variant="caption" color={t.textMuted}>
          6 h
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
        <View
          style={[
            styles.round,
            {
              backgroundColor: disabled ? t.locked : t.card,
              borderBottomWidth: pressed ? 2 : 5,
              marginTop: pressed ? 3 : 0,
            },
          ]}>
          <DuoText variant="title" color={disabled ? t.lockedText : Brand.blue}>
            {label}
          </DuoText>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  card: {
    borderWidth: 2,
    borderColor: t.border,
    borderBottomWidth: 5,
    borderRadius: t.radius.lg,
    padding: 18,
    backgroundColor: t.card,
  },
  header: { marginBottom: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valueBubble: { flex: 1, alignItems: 'center' },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { width: '100%', height: 48, marginTop: 10 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
}));
