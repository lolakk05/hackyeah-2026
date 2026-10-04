import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { Brand } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';

import { DuoText } from './duo-text';

/** Large text field with a label above it (and a show/hide toggle for passwords). */
export function DuoInput({
  label,
  error,
  secure,
  showLabel,
  hideLabel,
  ...rest
}: TextInputProps & {
  label: string;
  error?: string | null;
  /** Password field with a show/hide button. */
  secure?: boolean;
  showLabel?: string;
  hideLabel?: string;
}) {
  const t = useDuo();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      <DuoText variant="label" color={t.textMuted}>
        {label}
      </DuoText>
      <View style={[styles.field, focused && styles.focused, !!error && styles.invalid]}>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          placeholderTextColor={t.lockedText}
          selectionColor={Brand.primary}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? showLabel : hideLabel}
            hitSlop={10}
            style={styles.eye}>
            <DuoText style={styles.eyeIcon}>{hidden ? '👁️' : '🙈'}</DuoText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <DuoText variant="caption" color={Brand.danger} accessibilityLiveRegion="polite">
          {error}
        </DuoText>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderRadius: t.radius.lg,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: t.border,
    paddingHorizontal: 16,
  },
  focused: { borderColor: Brand.primary },
  invalid: { borderColor: Brand.danger },
  input: { flex: 1, fontSize: 17, color: t.text, paddingVertical: 14 },
  eye: { paddingLeft: 10 },
  eyeIcon: { fontSize: 20, lineHeight: 26 },
}));
