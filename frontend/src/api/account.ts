/**
 * ─────────────────────────────────────────────────────────────
 *  ACCOUNT API: sign-in, XP, coins, ranking and rewards
 * ─────────────────────────────────────────────────────────────
 * USE_MOCK_ACCOUNTS (no EXPO_PUBLIC_ACCOUNT_API_URL) → a sample backend that
 * stores everything on the phone (mock-accounts.ts).
 * Otherwise every call goes to ACCOUNT_API_URL + ACCOUNT_ENDPOINTS (config.ts),
 * with `Authorization: Bearer <token>` once signed in.
 */
import type { Lang } from '@/i18n/strings';

import { ACCOUNT_API_URL, ACCOUNT_ENDPOINTS, USE_AUTH_SERVER, USE_MOCK_ACCOUNTS } from './config';
import * as auth from './auth';
import { AccountError, type AccountErrorCode } from './account-error';
import * as mock from './mock-accounts';
import type { AccountUser, AuthSession, Ranking, Redemption, Reward, XpEvent, XpEventResult } from './types';

export { AccountError, type AccountErrorCode } from './account-error';

/** Network problems: the action can be retried later. */
export const isOffline = (e: unknown) => e instanceof AccountError && e.code === 'network';

let lang: Lang = 'en';
export function setAccountLanguage(next: Lang) {
  lang = next;
}

/** Request to the account backend (also used by issues.ts). */
export function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  return request<T>(ACCOUNT_API_URL, path, init);
}

/** JSON request to a backend; errors become AccountError. */
export async function request<T>(base: string, path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': lang,
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
    });
  } catch (e) {
    throw new AccountError(e instanceof Error ? e.message : String(e), 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw await toAccountError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Backend errors: `{ detail: { code, message } }` (preferred), FastAPI's
 * `{ detail: "text" }` or a validation list. The HTTP status is the fallback.
 */
async function toAccountError(res: Response): Promise<AccountError> {
  let detail: unknown;
  try {
    const body = (await res.json()) as { detail?: unknown; code?: string; message?: string };
    // Better Auth answers { code, message } at the top level
    detail = body.detail ?? (body.code || body.message ? { code: body.code, message: body.message } : undefined);
  } catch {
    // no JSON body
  }
  const known: AccountErrorCode[] = [
    'invalid_credentials',
    'email_taken',
    'username_taken',
    'not_enough_coins',
    'unauthorized',
    'validation',
  ];
  let message = `HTTP ${res.status}`;
  let code: AccountErrorCode | undefined;
  if (typeof detail === 'string') message = detail;
  else if (Array.isArray(detail)) {
    message = detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ') || message;
    code = 'validation';
  } else if (detail && typeof detail === 'object') {
    const d = detail as { code?: string; message?: string };
    message = d.message ?? message;
    if (d.code && (known as string[]).includes(d.code)) code = d.code as AccountErrorCode;
    else if (d.code) code = BETTER_AUTH_CODES[d.code];
  }
  if (!code) {
    if (res.status === 401) code = 'unauthorized';
    else if (res.status === 402) code = 'not_enough_coins';
    else if (res.status === 409) code = /user/i.test(message) ? 'username_taken' : 'email_taken';
    else if (res.status === 400 || res.status === 422) code = 'validation';
    else code = 'generic';
  }
  return new AccountError(message, code, res.status);
}

/** Error codes of the Better Auth server → the app's codes. */
const BETTER_AUTH_CODES: Record<string, AccountErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: 'invalid_credentials',
  INVALID_PASSWORD: 'invalid_credentials',
  USER_NOT_FOUND: 'invalid_credentials',
  USER_ALREADY_EXISTS: 'email_taken',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'email_taken',
  USER_EMAIL_ALREADY_EXISTS: 'email_taken',
  EMAIL_NOT_VERIFIED: 'email_not_verified',
  PASSWORD_TOO_SHORT: 'validation',
  PASSWORD_TOO_LONG: 'validation',
  INVALID_EMAIL: 'validation',
};

// ─── Sign-in ────────────────────────────────────────────────

export async function register(username: string, email: string, password: string): Promise<AuthSession> {
  if (USE_AUTH_SERVER) {
    const res = await auth.signUp(username, email, password);
    // No session yet: the server wants the email confirmed first.
    if (!res?.token || !res.user) throw new AccountError('Confirm your email, then sign in', 'check_email');
    return withProgress(res.token, res.user);
  }
  if (USE_MOCK_ACCOUNTS) return mock.register(username, email, password);
  return call<AuthSession>(ACCOUNT_ENDPOINTS.register, {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (USE_AUTH_SERVER) {
    const res = await auth.signIn(email, password).catch((e: unknown) => {
      if (e instanceof AccountError && e.code === 'unauthorized') throw new AccountError(e.message, 'invalid_credentials', 401);
      throw e;
    });
    if (!res?.token || !res.user) throw new AccountError('No session', 'invalid_credentials', 401);
    return withProgress(res.token, res.user);
  }
  if (USE_MOCK_ACCOUNTS) return mock.login(email, password);
  try {
    return await call<AuthSession>(ACCOUNT_ENDPOINTS.login, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    // On the login form, 401 means a wrong email or password.
    if (e instanceof AccountError && e.code === 'unauthorized') {
      throw new AccountError(e.message, 'invalid_credentials', 401);
    }
    throw e;
  }
}

/** Fresh totals for the signed-in user. */
export async function fetchMe(token: string): Promise<AccountUser> {
  if (USE_AUTH_SERVER) {
    const session = await auth.getSession(token);
    if (!session?.user) throw new AccountError('Session expired', 'unauthorized', 401);
    return (await withProgress(token, session.user)).user;
  }
  if (USE_MOCK_ACCOUNTS) return mock.me(token);
  return call<AccountUser>(ACCOUNT_ENDPOINTS.me, { token });
}

// ─── XP ─────────────────────────────────────────────────────

/** Report something that earns XP; the backend adds XP and coins. */
export async function sendXpEvent(token: string, event: XpEvent): Promise<XpEventResult> {
  if (USE_MOCK_ACCOUNTS) return mock.addXp(token, event);
  return call<XpEventResult>(ACCOUNT_ENDPOINTS.xpEvents, { method: 'POST', body: JSON.stringify(event), token });
}

// ─── Ranking ────────────────────────────────────────────────

export async function fetchRanking(token: string | null, limit = 50): Promise<Ranking> {
  if (USE_MOCK_ACCOUNTS) return mock.ranking(token, limit);
  return call<Ranking>(`${ACCOUNT_ENDPOINTS.ranking}?limit=${limit}`, { token: token ?? undefined });
}

// ─── Rewards ────────────────────────────────────────────────

export async function fetchRewards(): Promise<Reward[]> {
  if (USE_MOCK_ACCOUNTS) return mock.rewards(lang);
  return call<Reward[]>(ACCOUNT_ENDPOINTS.rewards);
}

/** Spend coins on a reward. Returns the discount code and the new coin balance. */
export async function redeemReward(token: string, rewardId: string): Promise<{ redemption: Redemption; coins: number }> {
  if (USE_MOCK_ACCOUNTS) return mock.redeem(token, rewardId, lang);
  return call(ACCOUNT_ENDPOINTS.redeem(rewardId), { method: 'POST', token });
}

export async function fetchRedemptions(token: string): Promise<Redemption[]> {
  if (USE_MOCK_ACCOUNTS) return mock.redemptions(token);
  return call<Redemption[]>(ACCOUNT_ENDPOINTS.redemptions, { token });
}

/** Sign out on the server (the app forgets the session either way). */
export async function signOut(token: string): Promise<void> {
  if (!USE_AUTH_SERVER) return;
  await auth.signOut(token).catch(() => {});
}

/**
 * Account from the sign-in server + XP and coins: from the account backend when
 * it is set (same token), otherwise kept on the phone by the sample backend.
 */
async function withProgress(token: string, user: auth.AuthUser): Promise<AuthSession> {
  const base = { id: user.id, username: user.name || user.email.split('@')[0], email: user.email };
  if (USE_MOCK_ACCOUNTS) return { token, user: await mock.linkUser(token, base) };
  try {
    const me = await call<AccountUser>(ACCOUNT_ENDPOINTS.me, { token });
    return { token, user: { ...base, xp: me.xp ?? 0, coins: me.coins ?? 0 } };
  } catch (e) {
    if (e instanceof AccountError && e.code === 'unauthorized') throw e;
    return { token, user: { ...base, xp: 0, coins: 0 } };
  }
}
