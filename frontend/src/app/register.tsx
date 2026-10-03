import { router } from 'expo-router';

import { AccountError } from '@/api/account';
import { useState } from 'react';

import { AuthLayout, authErrorMessage, EMAIL_RE, MIN_PASSWORD, USERNAME_RE } from '@/components/account/auth-layout';
import { DuoInput } from '@/components/duo/duo-input';
import { errorFeedback, successFeedback } from '@/components/duo/haptics';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';

/** Create an account: username, email and password. */
export default function RegisterScreen() {
  const { s, fmt } = useI18n();
  const account = useAccount();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    const next = {
      username: USERNAME_RE.test(username.trim()) ? undefined : s.auth.errors.usernameInvalid,
      email: EMAIL_RE.test(email.trim()) ? undefined : s.auth.errors.emailInvalid,
      password: password.length >= MIN_PASSWORD ? undefined : s.auth.errors.passwordShort,
    };
    setErrors(next);
    if (next.username || next.email || next.password) return;
    setLoading(true);
    try {
      await account.register(username.trim(), email.trim(), password);
      successFeedback();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/welcome');
    } catch (e) {
      setLoading(false);
      if (e instanceof AccountError && e.code === 'check_email') {
        // Account created; the server wants the email confirmed before signing in.
        setInfo(s.auth.errors.check_email);
        setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/login')), 3500);
        return;
      }
      errorFeedback();
      setError(authErrorMessage(e, s, fmt));
    }
  };

  return (
    <AuthLayout
      pose="cheer"
      title={s.auth.registerTitle}
      text={s.auth.registerText}
      error={error}
      info={info}
      submitLabel={s.auth.register}
      onSubmit={submit}
      loading={loading}
      switchText={s.auth.haveAccount}
      switchLabel={s.auth.loginLink}
      onSwitch={() => (router.canGoBack() ? router.back() : router.replace('/login'))}>
      <DuoInput
        label={s.auth.username}
        value={username}
        onChangeText={setUsername}
        error={errors.username}
        placeholder={s.auth.usernamePlaceholder}
        autoCorrect={false}
        autoComplete="name"
        textContentType="username"
        maxLength={40}
        autoCapitalize="words"
      />
      <DuoInput
        label={s.auth.email}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        placeholder={s.auth.emailPlaceholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <DuoInput
        label={s.auth.password}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder={s.auth.passwordPlaceholder}
        secure
        showLabel={s.auth.showPassword}
        hideLabel={s.auth.hidePassword}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </AuthLayout>
  );
}
