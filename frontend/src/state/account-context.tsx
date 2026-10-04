import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import * as api from '@/api/account';
import { AccountError, isOffline } from '@/api/account';
import type { AccountUser, AuthSession, XpEvent } from '@/api/types';
import { coinsForXp, levelInfo, xpForEvent, type LevelInfo } from '@/game/progression';
import { readJson, removeJson, writeJson } from '@/storage/json-file';

const SESSION_FILE = 'session-v1.json';
/** XP events not yet accepted by the backend (no connection); sent on the next chance. */
const PENDING_FILE = 'pending-xp-v1.json';

export type AccountStatus = 'loading' | 'signedOut' | 'signedIn';

/** What one action earned. */
export interface XpAward {
  xp: number;
  coins: number;
  /** true when counted on the phone because the backend couldn't be reached (synced later). */
  offline?: boolean;
}

export type XpEventInput = Omit<XpEvent, 'id' | 'createdAt'>;

interface AccountState {
  status: AccountStatus;
  user: AccountUser | null;
  token: string | null;
  level: LevelInfo;
  /** XP events waiting to be sent to the backend. */
  pendingCount: number;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Send waiting XP and fetch fresh totals (XP, coins) from the backend. */
  refresh: () => Promise<void>;
  /** Earn XP for an action; the backend adds XP and coins (0.5 per XP). */
  award: (event: XpEventInput) => Promise<XpAward>;
  /** Update the coin balance after spending coins (from the backend's answer). */
  setCoins: (coins: number) => void;
}

const AccountContext = createContext<AccountState | null>(null);

const newEventId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Refs, so async work always sees the latest values.
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AccountUser | null>(null);
  const pendingRef = useRef<XpEvent[]>([]);
  const flushing = useRef(false);

  const saveUser = useCallback((next: AccountUser | null) => {
    userRef.current = next;
    setUser(next);
    if (next && tokenRef.current) writeJson(SESSION_FILE, { token: tokenRef.current, user: next } satisfies AuthSession);
  }, []);

  const setPending = useCallback((events: XpEvent[]) => {
    pendingRef.current = events;
    setPendingCount(events.length);
    if (events.length) writeJson(PENDING_FILE, events);
    else removeJson(PENDING_FILE);
  }, []);

  const startSession = useCallback(
    (session: AuthSession) => {
      tokenRef.current = session.token;
      setToken(session.token);
      saveUser(session.user);
      setStatus('signedIn');
    },
    [saveUser],
  );

  const logout = useCallback(() => {
    tokenRef.current = null;
    userRef.current = null;
    setToken(null);
    setUser(null);
    setPending([]);
    removeJson(SESSION_FILE);
    setStatus('signedOut');
  }, [setPending]);

  /** Send waiting events in order; stop at the first network error. */
  const flushPending = useCallback(async () => {
    const t = tokenRef.current;
    if (!t || flushing.current || pendingRef.current.length === 0) return;
    flushing.current = true;
    try {
      while (pendingRef.current.length > 0) {
        const [event, ...rest] = pendingRef.current;
        try {
          const res = await api.sendXpEvent(t, event);
          if (userRef.current) saveUser({ ...userRef.current, xp: res.xp, coins: res.coins });
        } catch (e) {
          if (isOffline(e)) break; // try again later
          console.warn('[xp] backend rejected a saved event, dropping it', e);
        }
        setPending(rest);
      }
    } finally {
      flushing.current = false;
    }
  }, [saveUser, setPending]);

  const refresh = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    await flushPending();
    try {
      saveUser(await api.fetchMe(t));
    } catch (e) {
      if (e instanceof AccountError && e.code === 'unauthorized') logout();
      // offline: keep the saved totals
    }
  }, [flushPending, saveUser, logout]);

  // Restore the saved session when the app starts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [session, pending] = await Promise.all([
        readJson<AuthSession>(SESSION_FILE),
        readJson<XpEvent[]>(PENDING_FILE),
      ]);
      if (cancelled) return;
      if (pending?.length) setPending(pending);
      if (session?.token && session.user) {
        startSession(session);
        refresh();
      } else {
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(await api.login(email, password));
    },
    [startSession],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      startSession(await api.register(username, email, password));
    },
    [startSession],
  );

  const award = useCallback(
    async (input: XpEventInput): Promise<XpAward> => {
      const t = tokenRef.current;
      if (!t || !userRef.current) return { xp: 0, coins: 0 };
      const event: XpEvent = { ...input, id: newEventId(), createdAt: new Date().toISOString() };
      try {
        const res = await api.sendXpEvent(t, event);
        saveUser({ ...userRef.current, xp: res.xp, coins: res.coins });
        flushPending();
        return { xp: res.awarded, coins: res.coinsAwarded };
      } catch (e) {
        if (!isOffline(e)) {
          console.warn('[xp] could not award XP', e);
          if (e instanceof AccountError && e.code !== 'unauthorized') return { xp: 0, coins: 0 };
        }
        // No connection (or session problem): count it on the phone now, send it later.
        const xp = xpForEvent(event);
        const coins = coinsForXp(xp);
        const u = userRef.current;
        saveUser({ ...u, xp: u.xp + xp, coins: Math.round((u.coins + coins) * 10) / 10 });
        setPending([...pendingRef.current, event]);
        return { xp, coins, offline: true };
      }
    },
    [saveUser, flushPending, setPending],
  );

  const setCoins = useCallback(
    (coins: number) => {
      if (userRef.current) saveUser({ ...userRef.current, coins });
    },
    [saveUser],
  );

  const value: AccountState = {
    status,
    user,
    token,
    level: levelInfo(user?.xp ?? 0),
    pendingCount,
    login,
    register,
    logout,
    refresh,
    award,
    setCoins,
  };

  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): AccountState {
  const ctx = use(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}
