/**
 * Problem reports ("path blocked", "lift not working", …).
 * Sent to the account backend (they need the signed-in user); without
 * EXPO_PUBLIC_ACCOUNT_API_URL they are kept by the sample backend on the phone.
 */
import { MAP_BOUNDS } from '@/map/geo';

import { call } from './account';
import { ACCOUNT_ENDPOINTS, USE_MOCK_ACCOUNTS } from './config';
import * as mock from './mock-issues';
import type { IssueReport, IssueReportInput } from './types';

/** Open reports inside the map area. */
export async function fetchIssues(token: string | null): Promise<IssueReport[]> {
  if (USE_MOCK_ACCOUNTS) return mock.list();
  const b = MAP_BOUNDS;
  return call<IssueReport[]>(`${ACCOUNT_ENDPOINTS.issues}?south=${b.south}&west=${b.west}&north=${b.north}&east=${b.east}`, {
    token: token ?? undefined,
  });
}

/** Send a new report. The backend adds the user and returns the stored report. */
export async function submitIssue(token: string, report: IssueReportInput): Promise<IssueReport> {
  if (USE_MOCK_ACCOUNTS) return mock.submit(token, report);
  return call<IssueReport>(ACCOUNT_ENDPOINTS.issues, { method: 'POST', body: JSON.stringify(report), token });
}

/** "Still there": confirm someone else's report. */
export async function confirmIssue(token: string, id: string): Promise<{ confirmations: number }> {
  if (USE_MOCK_ACCOUNTS) return mock.confirm(token, id);
  return call(ACCOUNT_ENDPOINTS.confirmIssue(id), { method: 'POST', token });
}
