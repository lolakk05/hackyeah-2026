import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import * as api from '@/api/account';
import { AccountError, isOffline } from '@/api/account';
import type { AccountUser, AuthSession, XpEvent } from '@/api/types';
import { coinsForXp, levelInfo, xpForEvent, type LevelInfo } from '@/game/progression';
import { readJson, removeJson, writeJson } from '@/storage/json-file';

const SESSION_FILE = 'session-v1.json';
/**
 * XP events not yet accepted by the backend (no connection, or the session
 * expired), per user; sent on the next chance.
 */
const PENDING_FILE = 'pending-xp-v2.json';

export type AccountStatus = 'loading' | 'signedOut' | 'signedIn';

/** What one action earned. */
export interface XpAward {
  xp: number;
  coins: number;
  /** true when counted on the phone because the backend couldn't be reached (synced later). */
  offline?: boolean;
  /** The user's XP total after this award (to spot a level-up). */
  totalXp?: number;
}

export type XpEventInput = Omit<XpEvent, 'id' | 'createdAt'>;

interface PendingXp {
  userId: string;
  event: XpEvent;
}

interface AccountState {
  status: AccountStatus;
  user: AccountUser | null;
  token: string | null;
  level: LevelInfo;
  /** My XP events waiting to be sent to the backend. */
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
const round1 = (n: number) => Math.round(n * 10) / 10;
const shouldRetry = (e: unknown) => isOffline(e) || (e instanceof AccountError && e.code === 'unauthorized');

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Refs, so async work always sees the latest values.
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AccountUser | null>(null);
  const pendingRef = useRef<PendingXp[]>([]);
  const flushing = useRef(false);

  const myPending = () => pendingRef.current.filter((p) => p.userId === userRef.current?.id);

  const saveUser = useCallback((next: AccountUser | null) => {
    userRef.current = next;
    setUser(next);
    if (next && tokenRef.current) writeJson(SESSION_FILE, { token: tokenRef.current, user: next } satisfies AuthSession);
  }, []);

  const setPending = useCallback((list: PendingXp[]) => {
    pendingRef.current = list;
    setPendingCount(list.filter((p) => p.userId === userRef.current?.id).length);
    if (list.length) writeJson(PENDING_FILE, list);
    else removeJson(PENDING_FILE);
  }, []);

  /** Totals from the backend, plus XP still waiting to be sent (so nothing seems to vanish). */
  const applyTotals = useCallback(
    (base: AccountUser) => {
      const queued = pendingRef.current
        .filter((p) => p.userId === base.id)
        .reduce((sum, p) => sum + xpForEvent(p.event), 0);
      saveUser({ ...base, xp: base.xp + queued, coins: round1(base.coins + coinsForXp(queued)) });
    },
    [saveUser],
  );

  const startSession = useCallback(
    (session: AuthSession) => {
      tokenRef.current = session.token;
      setToken(session.token);
      userRef.current = session.user;
      applyTotals(session.user);
      setPendingCount(myPending().length);
      setStatus('signedIn');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyTotals],
  );

  /** Sign out. Unsent XP stays saved for this account and is sent after the next sign-in. */
  const logout = useCallback(() => {
    tokenRef.current = null;
    userRef.current = null;
    setToken(null);
    setUser(null);
    setPendingCount(0);
    removeJson(SESSION_FILE);
    setStatus('signedOut');
  }, []);

  /** Send my waiting events in order; stop at a network or session problem. */
  const flushPending = useCallback(async () => {
    const t = tokenRef.current;
    const uid = userRef.current?.id;
    if (!t || !uid || flushing.current) return;
    flushing.current = true;
    try {
      for (;;) {
        if (tokenRef.current !== t) break; // signed out meanwhile
        const next = pendingRef.current.find((p) => p.userId === uid);
        if (!next) break;
        try {
          const res = await api.sendXpEvent(t, next.event);
          if (tokenRef.current !== t) break;
          setPending(pendingRef.current.filter((p) => p !== next));
          if (userRef.current) applyTotals({ ...userRef.current, xp: res.xp, coins: res.coins });
        } catch (e) {
          if (shouldRetry(e)) break; // try again later
          console.warn('[xp] backend rejected a saved event, dropping it', e);
          setPending(pendingRef.current.filter((p) => p !== next));
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [setPending, applyTotals]);

  const refresh = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    await flushPending();
    try {
      const me = await api.fetchMe(t);
      if (tokenRef.current === t) applyTotals(me);
    } catch (e) {
      if (e instanceof AccountError && e.code === 'unauthorized' && tokenRef.current === t) logout();
      // offline: keep the saved totals
    }
  }, [flushPending, applyTotals, logout]);

  // Restore the saved session when the app starts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [session, pending] = await Promise.all([
        readJson<AuthSession>(SESSION_FILE),
        readJson<PendingXp[]>(PENDING_FILE),
      ]);
      if (cancelled) return;
      if (pending?.length) pendingRef.current = pending.filter((p) => p?.userId && p.event?.id);
      if (session?.token && session.user) {
        // The saved user already includes XP counted offline, so don't add the queue twice.
        tokenRef.current = session.token;
        setToken(session.token);
        saveUser(session.user);
        setPendingCount(myPending().length);
        setStatus('signedIn');
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
      refresh(); // sends XP saved for this account earlier
    },
    [startSession, refresh],
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
      const u = userRef.current;
      if (!t || !u) return { xp: 0, coins: 0 };
      const event: XpEvent = { ...input, id: newEventId(), createdAt: new Date().toISOString() };
      try {
        const res = await api.sendXpEvent(t, event);
        if (tokenRef.current === t && userRef.current) applyTotals({ ...userRef.current, xp: res.xp, coins: res.coins });
        flushPending();
        return { xp: res.awarded, coins: res.coinsAwarded, totalXp: userRef.current?.xp ?? res.xp };
      } catch (e) {
        if (!shouldRetry(e)) {
          console.warn('[xp] could not award XP', e);
          return { xp: 0, coins: 0 };
        }
        // No connection (or the session expired): count it on the phone now, send it later.
        const xp = xpForEvent(event);
        const coins = coinsForXp(xp);
        const cur = userRef.current ?? u;
        saveUser({ ...cur, xp: cur.xp + xp, coins: round1(cur.coins + coins) });
        setPending([...pendingRef.current, { userId: u.id, event }]);
        return { xp, coins, offline: true, totalXp: cur.xp + xp };
      }
    },
    [saveUser, flushPending, setPending, applyTotals],
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
