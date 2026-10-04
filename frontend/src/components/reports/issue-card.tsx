import { Pressable, View } from 'react-native';

import type { IssueReport } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { useI18n } from '@/i18n/language-context';
import type { Strings } from '@/i18n/strings';
import { useAccount } from '@/state/account-context';
import { useReports } from '@/state/reports-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { ISSUE_ICON, SEVERITY_COLOR } from './issue-presets';

/** "3 h ago" */
export function timeAgo(iso: string, s: Strings, fmt: (t: string, p?: Record<string, string | number>) => string) {
  const minutes = (Date.now() - Date.parse(iso)) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 1) return s.issues.ago.now;
  if (minutes < 60) return fmt(s.issues.ago.min, { n: Math.round(minutes) });
  if (minutes < 60 * 24) return fmt(s.issues.ago.hours, { n: Math.round(minutes / 60) });
  return fmt(s.issues.ago.days, { n: Math.round(minutes / 1440) });
}

/** Title (the ready-made label in the viewer's language) and text of a report. */
export function issueTexts(report: IssueReport, s: Strings) {
  // Unknown types (newer backend) are shown like "Something else".
  const preset = s.issues.types[report.type] as { label: string; message: string } | undefined;
  if (!preset || report.type === 'other') {
    return { title: s.issues.types.other.label, text: [report.message, report.comment].filter(Boolean).join(' · ') };
  }
  return { title: preset.label, text: report.comment || preset.message };
}

/** One problem report with its details and a "still there" button. */
export function IssueCard({ report, onClose }: { report: IssueReport; onClose?: () => void }) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { user } = useAccount();
  const { confirm, confirmedIds, pendingIds } = useReports();
  const { title, text } = issueTexts(report, s);
  const color = SEVERITY_COLOR[report.severity] ?? SEVERITY_COLOR.hard;
  const mine = !!user && report.userId === user.id;
  const pending = pendingIds.includes(report.id);
  const confirmed = confirmedIds.includes(report.id);
  const meta = [
    report.landmarkName ? `📍 ${report.landmarkName}` : null,
    timeAgo(report.createdAt, s, fmt),
    report.username ? fmt(s.issues.by, { name: mine ? s.ranking.you : report.username }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { borderColor: t.soft(color, 0.45) }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: t.soft(color, 0.7) }]}>
          <DuoText style={styles.emoji}>{ISSUE_ICON[report.type] ?? '⚠️'}</DuoText>
        </View>
        <View style={styles.texts}>
          <DuoText variant="heading" numberOfLines={2}>
            {title}
          </DuoText>
          {text ? (
            <DuoText variant="body" color={t.textMuted}>
              {text}
            </DuoText>
          ) : null}
        </View>
        {onClose ? (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={s.issues.close} hitSlop={12}>
            <DuoText variant="heading" color={t.textMuted}>
              ✕
            </DuoText>
          </Pressable>
        ) : null}
      </View>
      <DuoText variant="caption" color={t.textMuted}>
        {meta}
      </DuoText>
      <View style={styles.row}>
        <View style={[styles.chip, { backgroundColor: t.soft(color, 0.75) }]}>
          <DuoText variant="caption" style={styles.bold}>
            {s.issues.severities[report.severity] ?? s.issues.severities.hard}
          </DuoText>
        </View>
        {report.confirmations > 0 ? (
          <DuoText variant="caption" color={t.textMuted}>
            {fmt(s.issues.confirmations, { n: report.confirmations })}
          </DuoText>
        ) : null}
        <View style={styles.flex} />
        {pending ? (
          <DuoText variant="caption" color={t.textMuted}>
            {s.issues.pending}
          </DuoText>
        ) : !mine ? (
          <Pressable
            disabled={confirmed}
            onPress={() => {
              tapFeedback();
              confirm(report.id);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={[styles.confirm, confirmed && styles.confirmDone]}>
            <DuoText variant="caption" style={styles.bold}>
              {confirmed ? s.issues.confirmed : s.issues.stillThere}
            </DuoText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  card: { padding: 14, gap: 10, borderRadius: t.radius.xl, backgroundColor: t.card, borderWidth: 1.5 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26, lineHeight: 32 },
  texts: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  confirm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.cardRaised, borderWidth: 1, borderColor: t.border },
  confirmDone: { opacity: 0.6 },
}));
