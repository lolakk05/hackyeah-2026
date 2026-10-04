import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { AccountError, isOffline } from '@/api/account';
import { confirmIssue, fetchIssues, submitIssue } from '@/api/issues';
import type { IssueReport, IssueReportInput } from '@/api/types';
import { useI18n } from '@/i18n/language-context';
import { readJson, writeJson } from '@/storage/json-file';

import { useAccount, type XpAward } from './account-context';

/** Reports not yet accepted by the backend (no connection), per user; sent on the next refresh. */
const PENDING_FILE = 'pending-issues-v2.json';

interface PendingIssue {
  userId: string;
  report: IssueReportInput;
}

const shouldRetry = (e: unknown) => isOffline(e) || (e instanceof AccountError && e.code === 'unauthorized');

/** What the report form fills in; the rest (id, time, language, device) is added here. */
export type IssueDraft = Omit<IssueReportInput, 'id' | 'createdAt' | 'lang' | 'platform'>;

interface ReportsState {
  /** Open reports from the backend plus my reports still waiting to be sent. */
  issues: IssueReport[];
  /** Ids of my reports not sent yet. */
  pendingIds: string[];
  /** Ids I confirmed ("still there") in this session. */
  confirmedIds: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Send a report (kept on the phone if offline) and earn XP for it. */
  submit: (draft: IssueDraft) => Promise<{ report: IssueReport; earned: XpAward; offline: boolean }>;
  confirm: (id: string) => Promise<void>;
}

const ReportsContext = createContext<ReportsState | null>(null);

const newId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function ReportsProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const { token, user, award } = useAccount();
  const [serverIssues, setServerIssues] = useState<IssueReport[]>([]);
  const [pending, setPendingState] = useState<PendingIssue[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingIssue[]>([]);

  const setPending = useCallback((list: PendingIssue[]) => {
    pendingRef.current = list;
    setPendingState(list);
    writeJson(PENDING_FILE, list);
  }, []);

  useEffect(() => {
    readJson<PendingIssue[]>(PENDING_FILE).then((saved) => {
      const valid = (saved ?? []).filter((p) => p?.userId && p.report?.id);
      if (valid.length) {
        setPending([...valid, ...pendingRef.current.filter((p) => !valid.some((v) => v.report.id === p.report.id))]);
      }
    });
  }, [setPending]);

  /** Send my waiting reports in order; stop at a network or session problem. */
  const flush = useCallback(async () => {
    const uid = user?.id;
    if (!token || !uid) return;
    for (const item of pendingRef.current.filter((p) => p.userId === uid)) {
      try {
        await submitIssue(token, item.report);
      } catch (e) {
        if (shouldRetry(e)) return;
        if (__DEV__) console.log('[reports] backend rejected a saved report, dropping it', e);
      }
      setPending(pendingRef.current.filter((p) => p.report.id !== item.report.id));
    }
  }, [token, user?.id, setPending]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await flush();
      setServerIssues(await fetchIssues(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [flush, token]);

  const submit = useCallback(
    async (draft: IssueDraft) => {
      const input: IssueReportInput = {
        ...draft,
        id: newId(),
        lang: lang ?? 'en',
        platform: `${Platform.OS} ${Platform.Version}`,
        createdAt: new Date().toISOString(),
      };
      let report: IssueReport;
      let offline = false;
      try {
        if (!token) throw new Error('Not signed in');
        report = await submitIssue(token, input);
        setServerIssues((prev) => [report, ...prev.filter((i) => i.id !== report.id)]);
      } catch (e) {
        if (!shouldRetry(e) || !user) throw e;
        // No connection: keep it on the phone and show it on the map already.
        offline = true;
        setPending([...pendingRef.current, { userId: user.id, report: input }]);
        report = { ...input, userId: user?.id, username: user?.username, confirmations: 0, status: 'open' };
      }
      const earned = await award({ type: 'issue_report', reportId: input.id, landmarkId: input.landmarkId });
      return { report, earned, offline };
    },
    [lang, token, user, award, setPending],
  );

  const confirm = useCallback(
    async (id: string) => {
      if (!token || confirmedIds.includes(id)) return;
      setConfirmedIds((prev) => [...prev, id]);
      try {
        const { confirmations } = await confirmIssue(token, id);
        setServerIssues((prev) => prev.map((i) => (i.id === id ? { ...i, confirmations } : i)));
      } catch {
        setConfirmedIds((prev) => prev.filter((x) => x !== id));
      }
    },
    [token, confirmedIds],
  );

  const pendingReports = useMemo<IssueReport[]>(
    () =>
      pending
        .filter((p) => p.userId === user?.id && !serverIssues.some((i) => i.id === p.report.id))
        .map((p) => ({ ...p.report, userId: user?.id, username: user?.username, confirmations: 0, status: 'open' })),
    [pending, serverIssues, user?.id, user?.username],
  );
  const issues = useMemo(() => [...pendingReports, ...serverIssues], [pendingReports, serverIssues]);

  const value: ReportsState = {
    issues,
    pendingIds: pendingReports.map((p) => p.id),
    confirmedIds,
    loading,
    error,
    refresh,
    submit,
    confirm,
  };
  return <ReportsContext value={value}>{children}</ReportsContext>;
}

export function useReports(): ReportsState {
  const ctx = use(ReportsContext);
  if (!ctx) throw new Error('useReports must be used inside <ReportsProvider>');
  return ctx;
}
