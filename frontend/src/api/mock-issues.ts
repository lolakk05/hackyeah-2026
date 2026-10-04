/**
 * Sample backend for problem reports, kept on the phone (used when
 * EXPO_PUBLIC_ACCOUNT_API_URL is not set). Starts with a few example reports.
 */
import { readJson, writeJson } from '@/storage/json-file';

import { me } from './mock-accounts';
import type { IssueReport, IssueReportInput } from './types';

const FILE = 'mock-issues-v1.json';

interface Db {
  issues: IssueReport[];
  /** Report ids each user confirmed. */
  confirmed: Record<string, string[]>;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const sample = (
  id: string,
  type: IssueReport['type'],
  message: string,
  severity: IssueReport['severity'],
  affects: IssueReport['affects'],
  latitude: number,
  longitude: number,
  username: string,
  confirmations: number,
  hours: number,
  comment?: string,
): IssueReport => ({
  id,
  type,
  message,
  comment,
  severity,
  affects,
  location: { latitude, longitude },
  locationSource: 'gps',
  needs: { wheelchair: false, reducedMobility: false, lowVision: false, hearing: false },
  lang: 'pl',
  platform: 'sample',
  createdAt: hoursAgo(hours),
  username,
  confirmations,
  status: 'open',
});

/** Example reports so the map isn't empty in the demo. */
const SAMPLES: IssueReport[] = [
  sample('sample-1', 'construction', 'Roboty drogowe utrudniają przejście.', 'hard', ['wheelchair', 'lowVision'], 50.0636, 19.9396, 'Hejnalista', 4, 3, 'Chodnik zwężony przy Floriańskiej.'),
  sample('sample-2', 'surface', 'Chodnik jest zniszczony lub bardzo nierówny.', 'hard', ['wheelchair'], 50.0582, 19.9374, 'Kasia_z_Kazimierza', 2, 20),
  sample('sample-3', 'other', 'Boczne wejście z podjazdem jest dziś zamknięte, trzeba iść od strony Plant.', 'blocked', ['wheelchair', 'stepFree'], 50.0549, 19.9352, 'Lajkonik', 6, 5),
  sample('sample-4', 'crowded', 'Jest tu bardzo tłoczno, trudno przejść.', 'info', ['everyone'], 50.0517, 19.9466, 'Obwarzanek', 1, 1),
];

let db: Db | null = null;
async function load(): Promise<Db> {
  db ??= (await readJson<Db>(FILE)) ?? { issues: SAMPLES, confirmed: {} };
  return db;
}
const save = () => db && writeJson(FILE, db);
const wait = () => new Promise((r) => setTimeout(r, 300));

export async function list(): Promise<IssueReport[]> {
  await wait();
  const data = await load();
  return data.issues.filter((i) => i.status === 'open');
}

export async function submit(token: string, input: IssueReportInput): Promise<IssueReport> {
  await wait();
  const user = await me(token);
  const data = await load();
  const existing = data.issues.find((i) => i.id === input.id);
  if (existing) return existing; // already received
  const report: IssueReport = { ...input, userId: user.id, username: user.username, confirmations: 0, status: 'open' };
  data.issues = [report, ...data.issues];
  save();
  return report;
}

export async function confirm(token: string, id: string): Promise<{ confirmations: number }> {
  await wait();
  const data = await load();
  const issue = data.issues.find((i) => i.id === id);
  if (!issue) return { confirmations: 0 };
  const mine = data.confirmed[token] ?? [];
  if (!mine.includes(id)) {
    issue.confirmations += 1;
    data.confirmed[token] = [...mine, id];
    save();
  }
  return { confirmations: issue.confirmations };
}
