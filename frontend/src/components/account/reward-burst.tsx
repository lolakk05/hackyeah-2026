import { useEffect, useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { StatueModel, TrophyModel } from '@/components/models/statue-views';
import { tierForLevel } from '@/components/models/statues';
import { Brand } from '@/constants/duo-theme';
import { formatCoins, levelInfo } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import type { XpAward } from '@/state/account-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { useLevelTitle } from './level-card';

/**
 * Celebration after earning XP: a spinning 3D trophy with the points and
 * coins, or, after a level-up, the new statue. Closes by itself.
 */
export function RewardBurst({
  awards,
  bonusLabel,
  onClose,
}: {
  /** Everything earned in this moment (e.g. visit + route bonus). */
  awards: XpAward[];
  /** Extra line, e.g. "Route complete! +44 XP". */
  bonusLabel?: string;
  onClose: () => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const title = useLevelTitle();
  const xp = awards.reduce((sum, a) => sum + a.xp, 0);
  const coins = Math.round(awards.reduce((sum, a) => sum + a.coins, 0) * 10) / 10;
  const total = awards.at(-1)?.totalXp;
  const before = total !== undefined ? levelInfo(total - xp).level : null;
  const after = total !== undefined ? levelInfo(total).level : null;
  const levelUp = before !== null && after !== null && after > before;
  const newTier = after !== null ? tierForLevel(after) : null;
  const newStatue = levelUp && before !== null && newTier !== tierForLevel(before);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), levelUp ? 4200 : 2600);
    return () => clearTimeout(timer);
  }, [levelUp]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityHint={s.reward.tapToClose}>
        <View style={styles.card} accessibilityLiveRegion="polite">
          {newStatue && newTier ? (
            <StatueModel tier={newTier} backgroundColor={t.cardRaised} style={styles.model} />
          ) : (
            <TrophyModel backgroundColor={t.cardRaised} style={styles.model} />
          )}
          {levelUp && after !== null ? (
            <DuoText variant="title" color={Brand.primary} style={styles.center}>
              🎉 {fmt(s.reward.levelUp, { n: after })} · {title(after)}
            </DuoText>
          ) : (
            <DuoText variant="label" color={t.textMuted}>
              {s.reward.earned}
            </DuoText>
          )}
          {newStatue && newTier ? (
            <DuoText variant="heading" style={styles.center}>
              {fmt(s.reward.newStatue, { name: s.statues.tiers[newTier] })}
            </DuoText>
          ) : null}
          <DuoText variant="hero" color={Brand.primary}>
            +{xp} {s.common.xp}
          </DuoText>
          <DuoText variant="heading">+{formatCoins(coins, lang)} 🪙</DuoText>
          {bonusLabel ? (
            <DuoText variant="heading" color={Brand.success} style={styles.center}>
              {bonusLabel}
            </DuoText>
          ) : null}
          <DuoText variant="caption" color={t.lockedText}>
            {s.reward.tapToClose}
          </DuoText>
        </View>
      </Pressable>
    </Modal>
  );
}

const useStyles = themedStyles((t) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,10,18,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 6,
    padding: 22,
    borderRadius: t.radius.xl,
    backgroundColor: t.cardRaised,
    borderWidth: 1.5,
    borderColor: t.soft(Brand.primary, 0.4),
  },
  model: { width: 180, height: 180, marginBottom: 6 },
  center: { textAlign: 'center' },
}));
