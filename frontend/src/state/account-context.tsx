import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import * as api from '@/api/account';
import { AccountError, isOffline } from '@/api/account';
import { seedDemoIssues } from '@/api/issues';
import type { AccountUser, AuthSession, XpEvent } from '@/api/types';
import { applyEvent, EMPTY_STATS, unlockedIds, type AchievementId, type PlayerStats } from '@/game/achievements';
import { coinsForXp, levelInfo, xpForEvent, type LevelInfo } from '@/game/progression';
import { readJson, removeJson, writeJson } from '@/storage/json-file';

const SESSION_FILE = 'session-v1.json';
/**
 * XP events not yet accepted by the backend (no connection, or the session
 * expired), per user; sent on the next chance.
 */
const PENDING_FILE = 'pending-xp-v2.json';
/** Achievement stats per user id. */
const STATS_FILE = 'stats-v1.json';

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
  /** Sign in to the ready-made demo account (level, XP, coins, achievements already in). */
  startDemo: () => Promise<void>;
  logout: () => void;
  /** Send waiting XP and fetch fresh totals (XP, coins) from the backend. */
  refresh: () => Promise<void>;
  /** Earn XP for an action; the backend adds XP and coins (0.5 per XP). */
  award: (event: XpEventInput) => Promise<XpAward>;
  /** Update the coin balance after spending coins (from the backend's answer). */
  setCoins: (coins: number) => void;
  /** Counters for achievements (trips, km, places…). */
  stats: PlayerStats;
  /** Achievements unlocked just now, waiting to be shown. */
  newAchievements: AchievementId[];
  dismissAchievement: () => void;
}

const AccountContext = createContext<AccountState | null>(null);

/**
 * The demo account's achievement counters: some achievements done, others
 * close, so every part of the profile has something to show.
 */
const DEMO_STATS: PlayerStats = {
  trips: 4,
  meters: 8600,
  longestTrip: 3200,
  visits: 26,
  places: [
    // sample places (shown when the API is offline)
    'barbican',
    'st-marys',
    'cloth-hall',
    'town-hall-tower',
    'wawel-castle',
    'dragon',
    // places from the API list (GET /pois, sorted by id)
    'node-10091005353', // Teatr Współczesny w Krakowie
    'node-10573734931', // Muzeum Dominikanów
    'node-10702099103', // Kaplica pw. Świętego Jacka
    'node-10829813177', // Ołtarz Wita Stwosza
    'node-10878069005', // Kraków Pinball Museum
    'node-10901629620', // widok na Staw Kaczeńcowy
    'node-10921366576', // Kardynał Macharski na ławeczce
    'node-10967807083', // Park Zielone Serce Podgórza
    'node-11084128705', // kolorowe schody
    'node-11145601702', // Krzysztof Komeda
    'node-11165003942', // Rozbitkowie na Wiśle
    'node-11186611565', // Muzeum Kata Kacia Nora
    'node-11219556379', // Stanisław Wyspiański
    'node-11235812890', // Klezmer Music Venue
    'node-11360712316', // Mury Obronne
  ],
  answers: 12,
  issues: 2,
};

const newEventId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const round1 = (n: number) => Math.round(n * 10) / 10;
const shouldRetry = (e: unknown) => isOffline(e) || (e instanceof AccountError && e.code === 'unauthorized');

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [allStats, setAllStats] = useState<Record<string, PlayerStats>>({});
  const [newAchievements, setNewAchievements] = useState<AchievementId[]>([]);
  const statsRef = useRef<Record<string, PlayerStats>>({});
  useEffect(() => {
    readJson<Record<string, PlayerStats>>(STATS_FILE).then((saved) => {
      if (saved) {
        statsRef.current = { ...saved, ...statsRef.current };
        setAllStats(statsRef.current);
      }
    });
  }, []);

  /** Count an action for the achievements and queue any newly unlocked ones. */
  const recordStats = (userId: string, event: XpEvent, xpBefore: number, xpAfter: number) => {
    const before = statsRef.current[userId] ?? EMPTY_STATS;
    const after = applyEvent(before, event);
    statsRef.current = { ...statsRef.current, [userId]: after };
    setAllStats(statsRef.current);
    writeJson(STATS_FILE, statsRef.current);
    const had = unlockedIds(before, levelInfo(xpBefore).level);
    const fresh = unlockedIds(after, levelInfo(xpAfter).level).filter((id) => !had.includes(id));
    if (fresh.length) setNewAchievements((q) => [...q, ...fresh]);
  };

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
    if (tokenRef.current) api.signOut(tokenRef.current); // tell the server (no need to wait)
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
          if (__DEV__) console.log('[xp] backend rejected a saved event, dropping it', e);
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

  const startDemo = useCallback(async () => {
    const session = await api.demoSession();
    const id = session.user.id;
    // Same starting point every time: achievement counters and two reports of "mine".
    statsRef.current = { ...statsRef.current, [id]: DEMO_STATS };
    setAllStats(statsRef.current);
    writeJson(STATS_FILE, statsRef.current);
    setPending(pendingRef.current.filter((p) => p.userId !== id));
    await seedDemoIssues(id, session.user.username).catch(() => {});
    startSession(session);
  }, [startSession, setPending]);

  const award = useCallback(
    async (input: XpEventInput): Promise<XpAward> => {
      const t = tokenRef.current;
      const u = userRef.current;
      if (!t || !u) return { xp: 0, coins: 0 };
      const event: XpEvent = { ...input, id: newEventId(), createdAt: new Date().toISOString() };
      const xpBefore = u.xp;
      try {
        const res = await api.sendXpEvent(t, event);
        if (tokenRef.current === t && userRef.current) applyTotals({ ...userRef.current, xp: res.xp, coins: res.coins });
        flushPending();
        const totalXp = userRef.current?.xp ?? res.xp;
        recordStats(u.id, event, xpBefore, totalXp);
        return { xp: res.awarded, coins: res.coinsAwarded, totalXp };
      } catch (e) {
        if (!shouldRetry(e)) {
          if (__DEV__) console.log('[xp] could not award XP', e);
          return { xp: 0, coins: 0 };
        }
        // No connection (or the session expired): count it on the phone now, send it later.
        const xp = xpForEvent(event);
        const coins = coinsForXp(xp);
        const cur = userRef.current ?? u;
        saveUser({ ...cur, xp: cur.xp + xp, coins: round1(cur.coins + coins) });
        setPending([...pendingRef.current, { userId: u.id, event }]);
        recordStats(u.id, event, xpBefore, cur.xp + xp);
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
    startDemo,
    logout,
    refresh,
    award,
    setCoins,
    stats: (user && allStats[user.id]) || EMPTY_STATS,
    newAchievements,
    dismissAchievement: () => setNewAchievements((q) => q.slice(1)),
  };

  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): AccountState {
  const ctx = use(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}
