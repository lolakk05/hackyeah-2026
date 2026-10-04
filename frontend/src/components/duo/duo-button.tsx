import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, theme } from '@/constants/duo-theme';

import { DuoText } from './duo-text';
import { tapFeedback } from './haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger';

const PALETTE: Record<ButtonVariant | 'disabled', { bg: string; pressed: string; text: string; border?: string }> = {
  primary: { bg: Brand.primary, pressed: Brand.primaryPressed, text: Brand.onPrimary },
  secondary: { bg: theme.cardRaised, pressed: theme.card, text: theme.text, border: theme.border },
  success: { bg: Brand.success, pressed: '#2FBF80', text: '#06281A' },
  danger: { bg: Brand.danger, pressed: '#E85A5A', text: '#2B0707' },
  disabled: { bg: theme.locked, pressed: theme.locked, text: theme.lockedText },
};

/** Large, flat, rounded button. Big touch target (min 56 pt). */
export function DuoButton({
  title,
  subtitle,
  onPress,
  variant = 'primary',
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
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const isDisabled = disabled || loading;
  const colors = PALETTE[isDisabled && !loading ? 'disabled' : variant];

  return (
    <Pressable
      onPressIn={() => tapFeedback(size === 'lg')}
      onPress={() => onPress?.()}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={style}>
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            size === 'lg' ? styles.lg : styles.md,
            {
              backgroundColor: pressed ? colors.pressed : colors.bg,
              borderColor: colors.border ?? 'transparent',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <View style={styles.row}>
              {icon}
              <View style={styles.textCol}>
                <DuoText variant="heading" color={colors.text} style={styles.title} numberOfLines={1}>
                  {title}
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
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  lg: { minHeight: 60, paddingVertical: 10 },
  md: { minHeight: 52, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textCol: { alignItems: 'center' },
  title: { textAlign: 'center' },
  subtitle: { opacity: 0.8, textAlign: 'center' },
});
