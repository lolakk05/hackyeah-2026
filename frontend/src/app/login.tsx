import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { AuthLayout, authErrorMessage, EMAIL_RE } from '@/components/account/auth-layout';
import { DuoInput } from '@/components/duo/duo-input';
import { errorFeedback, successFeedback } from '@/components/duo/haptics';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';

/** Sign in with email and password. */
export default function LoginScreen() {
  const { s, fmt } = useI18n();
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A saved session was found when the app started → straight to the start page.
  // (Only when the screen opened before we knew; signing in here navigates by itself.)
  const statusOnOpen = useRef(account.status);
  useEffect(() => {
    if (account.status === 'signedIn' && statusOnOpen.current !== 'signedOut') router.replace('/welcome');
  }, [account.status]);

  const submit = async () => {
    setError(null);
    const badEmail = !EMAIL_RE.test(email.trim());
    setEmailError(badEmail ? s.auth.errors.emailInvalid : null);
    if (badEmail || !password) return;
    setLoading(true);
    try {
      await account.login(email.trim(), password);
      successFeedback();
      router.replace('/welcome');
    } catch (e) {
      errorFeedback();
      setError(authErrorMessage(e, s, fmt));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      pose="wave"
      title={s.auth.loginTitle}
      text={s.auth.loginText}
      error={error}
      submitLabel={s.auth.login}
      onSubmit={submit}
      loading={loading}
      switchText={s.auth.noAccount}
      switchLabel={s.auth.registerLink}
      onSwitch={() => router.push('/register')}>
      <DuoInput
        label={s.auth.email}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        placeholder={s.auth.emailPlaceholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <DuoInput
        label={s.auth.password}
        value={password}
        onChangeText={setPassword}
        secure
        showLabel={s.auth.showPassword}
        hideLabel={s.auth.hidePassword}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </AuthLayout>
  );
}
