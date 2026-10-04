import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import type { AccessibilityNeeds, ReportCategory } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { successFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { formatCoins } from '@/game/progression';
import type { XpAward } from '@/state/account-context';
import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/**
 * Which question to ask: the visitor's own need first (most useful data),
 * otherwise a random general one, so every visitor can help.
 */
export function pickReportCategory(needs: AccessibilityNeeds): ReportCategory {
  if (needs.wheelchair) return 'wheelchair';
  if (needs.reducedMobility) return 'stepFree';
  if (needs.lowVision) return 'lowVision';
  const general: ReportCategory[] = ['stepFree', 'smoothSurface', 'wheelchair'];
  return general[Math.floor(Math.random() * general.length)];
}

/** A simple yes/no question about the way the visitor just walked. */
export function ReportQuestion({
  visible,
  category,
  onAnswer,
  onDone,
}: {
  visible: boolean;
  category: ReportCategory;
  /** Send the answer; resolves to what it earned. */
  onAnswer: (accessible: boolean) => Promise<XpAward>;
  /** Called when the dialog should close (answered or skipped). */
  onDone: () => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const [sending, setSending] = useState<boolean | null>(null);
  const [thanks, setThanks] = useState<XpAward | null>(null);

  const answer = async (accessible: boolean) => {
    setSending(accessible);
    const earned = await onAnswer(accessible);
    successFeedback();
    setSending(null);
    setThanks(earned);
    setTimeout(onDone, 1100);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          {thanks !== null ? (
            <View style={styles.thanks}>
              <DuoText style={styles.bigIcon}>🙌</DuoText>
              <DuoText variant="title" style={styles.center}>
                {fmt(s.report.thanks, { n: thanks.xp, coins: formatCoins(thanks.coins, lang) })}
              </DuoText>
            </View>
          ) : (
            <>
              <View style={styles.iconBubble}>
                <DuoText style={styles.bigIcon}>♿</DuoText>
              </View>
              <DuoText variant="label" color={Brand.primary} style={styles.center}>
                {s.report.title}
              </DuoText>
              <DuoText variant="title" style={styles.center} accessibilityRole="header">
                {s.report.questions[category]}
              </DuoText>
              <DuoText variant="caption" color={t.textMuted} style={styles.center}>
                {s.report.intro}
              </DuoText>
              <View style={styles.buttons}>
                <DuoButton
                  title={`👍  ${s.common.yes}`}
                  variant="success"
                  style={styles.flex}
                  loading={sending === true}
                  disabled={sending !== null}
                  onPress={() => answer(true)}
                />
                <DuoButton
                  title={`👎  ${s.common.no}`}
                  variant="danger"
                  style={styles.flex}
                  loading={sending === false}
                  disabled={sending !== null}
                  onPress={() => answer(false)}
                />
              </View>
              <Pressable onPress={onDone} accessibilityRole="button" hitSlop={12} style={styles.skip}>
                <DuoText variant="body" color={t.textMuted}>
                  {s.report.skip}
                </DuoText>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = themedStyles((t) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,18,0.7)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    backgroundColor: t.card,
    borderRadius: t.radius.xl,
    padding: 24,
    paddingBottom: 28,
    gap: 12,
    alignItems: 'stretch',
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 12,
  },
  iconBubble: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: t.soft(Brand.primary, 0.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIcon: { fontSize: 34, lineHeight: 42, textAlign: 'center' },
  center: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  flex: { flex: 1 },
  skip: { alignSelf: 'center', paddingVertical: 8 },
  thanks: { alignItems: 'center', gap: 8, paddingVertical: 24 },
}));
