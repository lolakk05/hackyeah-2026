import { View } from 'react-native';

import type { AccessibilityInfo, AccessibilityNeeds } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { SectionCard } from './section-card';

const WHEELCHAIR = {
  full: { color: Brand.success, icon: '✅' },
  partial: { color: Brand.primary, icon: '⚠️' },
  none: { color: Brand.danger, icon: '⛔' },
  unknown: { color: '#93A2B8', icon: '❔' },
} as const;

/** Accessibility details, with the visitor's own needs highlighted. */
export function AccessibilityCard({ info, needs }: { info: AccessibilityInfo; needs: AccessibilityNeeds }) {
  const t = useDuo();
  const styles = useStyles();
  const { s } = useI18n();
  const wc = WHEELCHAIR[info.wheelchair];
  const rows: { icon: string; label: string; ok: boolean; highlight: boolean }[] = [
    { icon: '🚶', label: s.access.stepFree, ok: info.stepFree, highlight: needs.reducedMobility || needs.wheelchair },
    { icon: '🚻', label: s.access.toilet, ok: info.accessibleToilet, highlight: needs.wheelchair },
    { icon: '🎧', label: s.access.audioGuide, ok: info.audioGuide, highlight: needs.lowVision },
    { icon: '👂', label: s.access.hearing, ok: info.hearingSupport, highlight: needs.hearing },
  ];

  return (
    <SectionCard title={s.access.title} icon="♿">
      <View style={[styles.banner, { backgroundColor: t.soft(wc.color, 0.8) }]} accessibilityRole="text">
        <DuoText style={styles.bannerIcon}>{wc.icon}</DuoText>
        <DuoText variant="heading" style={styles.bannerText}>
          {s.access[info.wheelchair]}
        </DuoText>
      </View>

      <View style={styles.grid}>
        {rows.map((r) => (
          <View
            key={r.label}
            style={[styles.row, r.highlight && styles.rowHighlight]}
            accessibilityLabel={`${r.label}: ${r.ok ? s.common.yes : s.common.no}`}>
            <DuoText style={styles.rowIcon}>{r.icon}</DuoText>
            <DuoText variant="body" style={styles.rowLabel}>
              {r.label}
            </DuoText>
            <View style={[styles.pill, { backgroundColor: r.ok ? t.soft(Brand.success, 0.7) : t.locked }]}>
              <DuoText variant="label" color={r.ok ? Brand.success : t.textMuted}>
                {r.ok ? s.common.yes : s.common.no}
              </DuoText>
            </View>
          </View>
        ))}
      </View>

      {info.notes ? (
        <DuoText variant="body" color={t.textMuted}>
          {info.notes}
        </DuoText>
      ) : null}
    </SectionCard>
  );
}

const useStyles = themedStyles((t) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: t.radius.md,
  },
  bannerIcon: { fontSize: 24, lineHeight: 30 },
  bannerText: { flex: 1, fontSize: 17 },
  grid: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: t.radius.sm,
  },
  rowHighlight: { backgroundColor: t.cardRaised },
  rowIcon: { fontSize: 22, lineHeight: 28 },
  rowLabel: { flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
}));
