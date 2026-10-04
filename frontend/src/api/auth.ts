/**
 * Sign-in server (Better Auth): EXPO_PUBLIC_AUTH_API_URL in `.env`.
 *
 *   POST /api/auth/sign-up/email   { name, email, password } → { token, user }
 *   POST /api/auth/sign-in/email   { email, password }       → { token, user }
 *   POST /api/auth/sign-out
 *   GET  /api/auth/get-session                               → { session, user } | null
 *
 * The app keeps the returned `token` and sends it as `Authorization: Bearer`
 * (Better Auth's bearer plugin). The session cookie the server sets is also
 * kept by the phone, so get-session works with either.
 */
import { request } from './account';
import { AUTH_API_URL, AUTH_ENDPOINTS } from './config';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
}

interface SignResponse {
  token: string | null;
  user: AuthUser;
}

/**
 * Better Auth only accepts requests from trusted origins. A phone app has no
 * origin of its own, so it sends the server's own address (the origin the
 * server allows: see `access-control-allow-origin`).
 */
const ORIGIN_HEADERS = { Origin: AUTH_API_URL };

const post = <T>(path: string, body: unknown, token?: string) =>
  request<T>(AUTH_API_URL, path, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
    credentials: 'include',
    headers: ORIGIN_HEADERS,
  });

export const signUp = (name: string, email: string, password: string) =>
  post<SignResponse>(AUTH_ENDPOINTS.signUp, { name, email, password });

export const signIn = (email: string, password: string) => post<SignResponse>(AUTH_ENDPOINTS.signIn, { email, password });

export const signOut = (token: string) => post<unknown>(AUTH_ENDPOINTS.signOut, {}, token);

export const getSession = (token: string) =>
  request<{ session: unknown; user: AuthUser } | null>(AUTH_API_URL, AUTH_ENDPOINTS.session, {
    token,
    credentials: 'include',
    headers: ORIGIN_HEADERS,
  });
