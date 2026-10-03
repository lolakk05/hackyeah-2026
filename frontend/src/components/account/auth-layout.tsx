import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountError } from '@/api/account';
import { USE_AUTH_SERVER, USE_MOCK_ACCOUNTS } from '@/api/config';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { Pinek, type PinekPose } from '@/components/pinek';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import type { Strings } from '@/i18n/strings';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Turn a login/register error into a message for the form. */
export function authErrorMessage(e: unknown, s: Strings, fmt: (t: string, p?: Record<string, string | number>) => string) {
  if (e instanceof AccountError) {
    switch (e.code) {
      case 'invalid_credentials':
      case 'email_not_verified':
      case 'check_email':
      case 'email_taken':
      case 'username_taken':
      case 'network':
        return s.auth.errors[e.code];
      case 'validation':
        return e.message;
      default:
        return fmt(s.auth.errors.generic, { msg: e.message });
    }
  }
  return fmt(s.auth.errors.generic, { msg: e instanceof Error ? e.message : String(e) });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A name like "Jan Kowalski" or a nickname. */
export const USERNAME_RE = /^[A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ._-]{2,40}$/;
/** The sign-in server needs at least 8 characters. */
export const MIN_PASSWORD = 8;

/** Shared layout of the sign-in and register screens. */
export function AuthLayout({
  pose,
  title,
  text,
  children,
  error,
  info,
  submitLabel,
  onSubmit,
  loading,
  switchText,
  switchLabel,
  onSwitch,
}: {
  /** Pinek's pose at the top. */
  pose: PinekPose;
  title: string;
  text: string;
  children: ReactNode;
  error: string | null;
  /** Neutral message (e.g. "check your email"). */
  info?: string | null;
  submitLabel: string;
  onSubmit: () => void;
  loading: boolean;
  switchText: string;
  switchLabel: string;
  onSwitch: () => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s, lang } = useI18n();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel={s.language.change}
          hitSlop={10}
          style={styles.langChip}>
          <DuoText variant="caption" style={styles.bold}>
            {lang === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN'}
          </DuoText>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pinek pose={pose} size={110} />
          <View style={styles.texts}>
            <DuoText variant="hero" accessibilityRole="header">
              {title}
            </DuoText>
            <DuoText variant="body" color={t.textMuted}>
              {text}
            </DuoText>
          </View>

          <View style={styles.fields}>{children}</View>

          {error ? (
            <View style={styles.errorBox} accessibilityLiveRegion="assertive">
              <DuoText variant="caption" color={Brand.danger}>
                {error}
              </DuoText>
            </View>
          ) : null}

          {info ? (
            <View style={styles.infoBox} accessibilityLiveRegion="polite">
              <DuoText variant="body">✉️ {info}</DuoText>
            </View>
          ) : null}

          <DuoButton title={submitLabel} onPress={onSubmit} loading={loading} />

          <View style={styles.switchRow}>
            <DuoText variant="body" color={t.textMuted}>
              {switchText}
            </DuoText>
            <Pressable onPress={onSwitch} accessibilityRole="link" hitSlop={10}>
              <DuoText variant="body" color={Brand.primary} style={styles.bold}>
                {switchLabel}
              </DuoText>
            </Pressable>
          </View>

          {USE_MOCK_ACCOUNTS && !USE_AUTH_SERVER ? (
            <DuoText variant="caption" color={t.lockedText} style={styles.center}>
              {s.auth.demoNote}
            </DuoText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 8 },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card },
  bold: { fontWeight: '700' },
  content: { padding: 24, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: t.soft(Brand.primary, 0.75),
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  icon: { fontSize: 38, lineHeight: 46 },
  texts: { gap: 6 },
  fields: { gap: 16 },
  infoBox: { padding: 12, borderRadius: t.radius.md, backgroundColor: t.soft(Brand.success, 0.8) },
  errorBox: { padding: 12, borderRadius: t.radius.md, backgroundColor: t.soft(Brand.danger, 0.85) },
  switchRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  center: { textAlign: 'center' },
}));
