import type { IssueGroup, IssueSeverity, IssueType } from '@/api/types';
import { Brand } from '@/constants/duo-theme';

/** Ready-made problem reports: icon, how serious, and who they affect. */
export const ISSUE_PRESETS: { type: Exclude<IssueType, 'other'>; icon: string; severity: IssueSeverity; affects: IssueGroup[] }[] = [
  { type: 'blocked', icon: '🚧', severity: 'blocked', affects: ['everyone'] },
  { type: 'construction', icon: '🏗️', severity: 'hard', affects: ['wheelchair', 'lowVision'] },
  { type: 'surface', icon: '🕳️', severity: 'hard', affects: ['wheelchair', 'lowVision'] },
  { type: 'stairs', icon: '🪜', severity: 'blocked', affects: ['wheelchair', 'stepFree'] },
  { type: 'kerb', icon: '♿', severity: 'hard', affects: ['wheelchair'] },
  { type: 'lift', icon: '🛗', severity: 'blocked', affects: ['wheelchair', 'stepFree'] },
  { type: 'crossing', icon: '🚦', severity: 'hard', affects: ['lowVision', 'everyone'] },
  { type: 'crowded', icon: '👥', severity: 'info', affects: ['everyone'] },
];

export const ISSUE_ICON: Record<IssueType, string> = {
  ...(Object.fromEntries(ISSUE_PRESETS.map((p) => [p.type, p.icon])) as Record<Exclude<IssueType, 'other'>, string>),
  other: '✏️',
};

export const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  blocked: Brand.danger,
  hard: '#FF9F43',
  info: Brand.sky,
};

export const ISSUE_GROUPS: IssueGroup[] = ['wheelchair', 'stepFree', 'lowVision', 'everyone'];
export const ISSUE_SEVERITIES: IssueSeverity[] = ['info', 'hard', 'blocked'];
