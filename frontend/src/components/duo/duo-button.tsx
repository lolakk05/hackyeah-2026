import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, type DuoTheme } from '@/constants/duo-theme';
import { useDuo } from '@/state/theme-context';

import { DuoText } from './duo-text';
import { tapFeedback } from './haptics';

type Variant = 'green' | 'blue' | 'orange' | 'red' | 'white' | 'locked';

function palette(t: DuoTheme, variant: Variant): { face: string; edge: string; text: string; border?: string } {
  switch (variant) {
    case 'green':
      return { face: Brand.green, edge: Brand.greenDark, text: Brand.onColor };
    case 'blue':
      return { face: Brand.blue, edge: Brand.blueDark, text: Brand.onColor };
    case 'orange':
      return { face: Brand.orange, edge: Brand.orangeDark, text: Brand.onColor };
    case 'red':
      return { face: Brand.red, edge: Brand.redDark, text: Brand.onColor };
    case 'white':
      return { face: t.card, edge: t.border, text: t.blueText, border: t.border };
    case 'locked':
      return { face: t.locked, edge: t.lockedDark, text: t.lockedText };
  }
}

const EDGE = 5;

/**
 * Big chunky "3D" button, like Duolingo's CONTINUE.
 * The darker bottom edge disappears while pressed so the button "sinks".
 */
export function DuoButton({
  title,
  subtitle,
  onPress,
  variant = 'green',
  size = 'lg',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'lg' | 'md';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const t = useDuo();
  const isDisabled = disabled || loading;
  const colors = palette(t, isDisabled && !loading ? 'locked' : variant);
  const height = size === 'lg' ? 64 : 52;

  return (
    <Pressable
      onPress={() => {
        tapFeedback(size === 'lg');
        onPress?.();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[{ minHeight: height + EDGE }, style]}>
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            {
              borderRadius: t.radius.lg,
              minHeight: height + (pressed ? 0 : EDGE),
              marginTop: pressed ? EDGE : 0,
              backgroundColor: colors.face,
              borderBottomWidth: pressed ? (colors.border ? 2 : 0) : EDGE,
              borderBottomColor: colors.edge,
              borderColor: colors.border ?? colors.face,
              borderWidth: colors.border ? 2 : 0,
            },
          ]}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <View style={styles.row}>
              {icon}
              <View style={styles.textCol}>
                <DuoText
                  variant={size === 'lg' ? 'heading' : 'label'}
                  color={colors.text}
                  style={styles.title}
                  numberOfLines={1}>
                  {title.toUpperCase()}
                </DuoText>
                {subtitle ? (
                  <DuoText variant="caption" color={colors.text} style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </DuoText>
                ) : null}
              </View>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textCol: { alignItems: 'center' },
  title: { letterSpacing: 1, textAlign: 'center' },
  subtitle: { opacity: 0.9, textAlign: 'center' },
});
