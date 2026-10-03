import { View } from 'react-native';

import type { AccessibilityInfo, AccessibilityNeeds } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { Brand } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';

import { SectionCard } from './section-card';

const WHEELCHAIR = {
  full: { label: 'Fully wheelchair accessible', color: Brand.green, icon: '✅' },
  partial: { label: 'Partly wheelchair accessible', color: Brand.orange, icon: '⚠️' },
  none: { label: 'Not wheelchair accessible', color: Brand.red, icon: '⛔' },
} as const;

/** Accessibility details, with the visitor's own needs highlighted. */
export function AccessibilityCard({ info, needs }: { info: AccessibilityInfo; needs: AccessibilityNeeds }) {
  const t = useDuo();
  const styles = useStyles();
  const wc = WHEELCHAIR[info.wheelchair];
  const rows: { icon: string; label: string; ok: boolean; highlight: boolean }[] = [
    { icon: '🚶', label: 'Step-free route', ok: info.stepFree, highlight: needs.reducedMobility || needs.wheelchair },
    { icon: '🚻', label: 'Accessible toilet', ok: info.accessibleToilet, highlight: needs.wheelchair },
    { icon: '🎧', label: 'Audio guide', ok: info.audioGuide, highlight: needs.lowVision },
    { icon: '👂', label: 'Hearing loop / written guide', ok: info.hearingSupport, highlight: needs.hearing },
  ];

  return (
    <SectionCard title="Accessibility" icon="♿">
      <View
        style={[styles.banner, { backgroundColor: t.soft(wc.color), borderColor: wc.color }]}
        accessibilityRole="text">
        <DuoText style={styles.bannerIcon}>{wc.icon}</DuoText>
        <DuoText variant="heading" color={t.text} style={styles.bannerText}>
          {wc.label}
        </DuoText>
      </View>

      <View style={styles.grid}>
        {rows.map((r) => (
          <View
            key={r.label}
            style={[styles.row, r.highlight && styles.rowHighlight]}
            accessibilityLabel={`${r.label}: ${r.ok ? 'yes' : 'no'}`}>
            <DuoText style={styles.rowIcon}>{r.icon}</DuoText>
            <DuoText variant="body" style={styles.rowLabel}>
              {r.label}
            </DuoText>
            <View style={[styles.pill, { backgroundColor: r.ok ? Brand.green : t.locked }]}>
              <DuoText variant="label" color={r.ok ? Brand.onColor : t.textMuted}>
                {r.ok ? 'YES' : 'NO'}
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
    borderWidth: 2,
  },
  bannerIcon: { fontSize: 24, lineHeight: 30 },
  bannerText: { flex: 1, fontSize: 18 },
  grid: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: t.radius.sm,
  },
  rowHighlight: { backgroundColor: t.soft(Brand.blue) },
  rowIcon: { fontSize: 22, lineHeight: 28 },
  rowLabel: { flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
}));
