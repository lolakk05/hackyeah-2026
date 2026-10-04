/**
 * Sample account backend that runs on the phone (used when
 * EXPO_PUBLIC_ACCOUNT_API_URL is not set). Accounts, XP, coins and codes are
 * saved in the app's private files, so they survive restarts.
 * Demo only: discount codes made here are not real tickets.
 */
import { coinsForXp, xpForEvent } from '@/game/progression';
import type { Lang } from '@/i18n/strings';
import { readJson, writeJson } from '@/storage/json-file';

import { AccountError } from './account-error';
import type {
  AccountUser,
  AuthSession,
  Ranking,
  RankingEntry,
  Redemption,
  Reward,
  XpEvent,
  XpEventResult,
} from './types';

const DB_FILE = 'mock-accounts-v1.json';
const DELAY_MS = 350;

interface MockUser extends AccountUser {
  passwordHash: string;
  redemptions: Redemption[];
  /** Event ids already counted (re-sent events give no extra XP). */
  seenEvents: string[];
}

interface Db {
  users: MockUser[];
}

/** Other players, so the ranking isn't empty in the demo. */
const SAMPLE_PLAYERS: { username: string; xp: number }[] = [
  { username: 'Lajkonik', xp: 1840 },
  { username: 'SmokWawelski', xp: 1420 },
  { username: 'Obwarzanek', xp: 1105 },
  { username: 'Hejnalista', xp: 860 },
  { username: 'Kasia_z_Kazimierza', xp: 640 },
  { username: 'PlantyRunner', xp: 455 },
  { username: 'Zapiekanka', xp: 300 },
  { username: 'Bajgiel', xp: 180 },
  { username: 'Turysta_Tomek', xp: 95 },
  { username: 'Ania.spaceruje', xp: 40 },
];

const REWARDS: Record<Lang, Reward[]> = {
  pl: [
    { id: 'kmk-20min', title: '−50% na bilet 20-minutowy', description: 'Komunikacja Miejska w Krakowie. Kod ważny 30 dni.', cost: 30, icon: '🚋' },
    { id: 'kmk-60min', title: '−50% na bilet 60-minutowy', description: 'Komunikacja Miejska w Krakowie. Kod ważny 30 dni.', cost: 50, icon: '🚌' },
    { id: 'kmk-24h', title: '−30% na bilet 24-godzinny', description: 'Cały dzień tramwajami i autobusami. Kod ważny 30 dni.', cost: 120, icon: '🎫' },
    { id: 'kmk-72h', title: '−30% na bilet 72-godzinny', description: 'Trzy dni jazdy po Krakowie. Kod ważny 30 dni.', cost: 250, icon: '🗓️' },
  ],
  en: [
    { id: 'kmk-20min', title: '50% off a 20-minute ticket', description: 'Kraków public transport (KMK). Code valid for 30 days.', cost: 30, icon: '🚋' },
    { id: 'kmk-60min', title: '50% off a 60-minute ticket', description: 'Kraków public transport (KMK). Code valid for 30 days.', cost: 50, icon: '🚌' },
    { id: 'kmk-24h', title: '30% off a 24-hour ticket', description: 'A whole day of trams and buses. Code valid for 30 days.', cost: 120, icon: '🎫' },
    { id: 'kmk-72h', title: '30% off a 72-hour ticket', description: 'Three days of travel around Kraków. Code valid for 30 days.', cost: 250, icon: '🗓️' },
  ],
};

let db: Db | null = null;

async function load(): Promise<Db> {
  db ??= (await readJson<Db>(DB_FILE)) ?? { users: [] };
  return db;
}

function save() {
  if (db) writeJson(DB_FILE, db);
}

const wait = () => new Promise((r) => setTimeout(r, DELAY_MS));

/** Not real security: the sample backend only keeps a simple hash on the phone. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const publicUser = ({ id, username, email, xp, coins }: MockUser): AccountUser => ({ id, username, email, xp, coins });
const tokenFor = (u: MockUser) => `mock.${u.id}`;

async function userFor(token: string | null): Promise<MockUser> {
  const data = await load();
  const user = data.users.find((u) => tokenFor(u) === token);
  if (!user) throw new AccountError('Session expired', 'unauthorized', 401);
  return user;
}

export async function register(username: string, email: string, password: string): Promise<AuthSession> {
  await wait();
  const data = await load();
  const name = username.trim();
  const mail = email.trim().toLowerCase();
  const taken = (n: string) => n.toLowerCase() === name.toLowerCase();
  if (data.users.some((u) => u.email === mail)) throw new AccountError('Email already registered', 'email_taken', 409);
  if (data.users.some((u) => taken(u.username)) || SAMPLE_PLAYERS.some((p) => taken(p.username))) {
    throw new AccountError('Username taken', 'username_taken', 409);
  }
  const user: MockUser = {
    id: `u${Date.now().toString(36)}`,
    username: name,
    email: mail,
    xp: 0,
    coins: 0,
    passwordHash: hash(password),
    redemptions: [],
    seenEvents: [],
  };
  data.users.push(user);
  save();
  return { token: tokenFor(user), user: publicUser(user) };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  await wait();
  const data = await load();
  const user = data.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user || user.passwordHash !== hash(password)) {
    throw new AccountError('Wrong email or password', 'invalid_credentials', 401);
  }
  return { token: tokenFor(user), user: publicUser(user) };
}

export async function me(token: string): Promise<AccountUser> {
  return publicUser(await userFor(token));
}

export async function addXp(token: string, event: XpEvent): Promise<XpEventResult> {
  await wait();
  const user = await userFor(token);
  let awarded = 0;
  let coinsAwarded = 0;
  if (!user.seenEvents.includes(event.id)) {
    awarded = xpForEvent(event);
    coinsAwarded = coinsForXp(awarded);
    user.xp += awarded;
    user.coins = Math.round((user.coins + coinsAwarded) * 10) / 10;
    user.seenEvents = [...user.seenEvents.slice(-500), event.id];
    save();
  }
  return { awarded, coinsAwarded, xp: user.xp, coins: user.coins };
}

export async function ranking(token: string | null, limit: number): Promise<Ranking> {
  await wait();
  const data = await load();
  const players = [
    ...SAMPLE_PLAYERS.map((p, i) => ({ userId: `sample-${i}`, username: p.username, xp: p.xp })),
    ...data.users.map((u) => ({ userId: u.id, username: u.username, xp: u.xp })),
  ].sort((a, b) => b.xp - a.xp);
  const entries: RankingEntry[] = players.map((p, i) => ({ ...p, rank: i + 1 }));
  const meUser = token ? data.users.find((u) => tokenFor(u) === token) : undefined;
  return { entries: entries.slice(0, limit), me: entries.find((e) => e.userId === meUser?.id) };
}

export async function rewards(lang: Lang): Promise<Reward[]> {
  await wait();
  return REWARDS[lang];
}

export async function redeem(token: string, rewardId: string, lang: Lang): Promise<{ redemption: Redemption; coins: number }> {
  await wait();
  const user = await userFor(token);
  const reward = REWARDS[lang].find((r) => r.id === rewardId);
  if (!reward) throw new AccountError('Unknown reward', 'generic', 404);
  if (user.coins < reward.cost) throw new AccountError('Not enough coins', 'not_enough_coins', 402);
  user.coins = Math.round((user.coins - reward.cost) * 10) / 10;
  const now = new Date();
  const redemption: Redemption = {
    id: `r${now.getTime().toString(36)}`,
    rewardId,
    title: reward.title,
    code: `DEMO-${randomBlock()}-${randomBlock()}`,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
  };
  user.redemptions = [redemption, ...user.redemptions];
  save();
  return { redemption, coins: user.coins };
}

export async function redemptions(token: string): Promise<Redemption[]> {
  await wait();
  return (await userFor(token)).redemptions;
}

function randomBlock() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
