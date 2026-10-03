import { Pressable, View } from 'react-native';

import type { Landmark } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import type { StopStatus } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

export const TILE = 84;
export const CARD_PADDING = 12;

/**
 * One stop on the roadmap: a card with the 3D mini-model in a rounded tile.
 * current → gold outline + "Next stop" tag, spinning model
 * completed → green check · locked → greyed out
 */
export function RoadmapNode({
  landmark,
  status,
  index,
  onPress,
}: {
  landmark: Landmark;
  status: StopStatus;
  index: number;
  onPress: () => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const locked = status === 'locked';
  const current = status === 'current';
  const tileColor = locked ? t.locked : landmark.color;
  const statusText = status === 'completed' ? s.roadmap.visited : current ? s.roadmap.next : s.roadmap.locked;

  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${fmt(s.roadmap.stop, { n: index + 1 })}: ${landmark.name}, ${statusText}`}>
      {({ pressed }) => (
        <View style={[styles.card, current && styles.cardCurrent, pressed && styles.cardPressed]}>
          <View style={[styles.tile, { backgroundColor: tileColor }]}>
            <LandmarkModel
              kind={landmark.model}
              backgroundColor={tileColor}
              animate={current}
              locked={locked}
              style={styles.model}
            />
            {status === 'completed' ? (
              <View style={styles.check} pointerEvents="none">
                <DuoText variant="label" color="#06281A">
                  ✓
                </DuoText>
              </View>
            ) : null}
          </View>

          <View style={styles.texts}>
            <DuoText variant="label" color={current ? Brand.primary : t.textMuted}>
              {fmt(s.roadmap.stop, { n: index + 1 })} · {fmt(s.roadmap.visit, { time: formatDuration(landmark.visitMinutes) })}
            </DuoText>
            <DuoText variant="heading" color={locked ? t.textMuted : t.text} numberOfLines={2}>
              {landmark.name}
            </DuoText>
            <DuoText variant="caption" color={t.textMuted} numberOfLines={1}>
              {landmark.tagline}
            </DuoText>
          </View>

          {current ? (
            <View style={styles.nextTag}>
              <DuoText variant="label" color={Brand.onPrimary}>
                {s.roadmap.next}
              </DuoText>
            </View>
          ) : (
            <DuoText style={styles.chevron} color={t.lockedText}>
              ›
            </DuoText>
          )}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: CARD_PADDING,
    borderRadius: t.radius.xl,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardCurrent: { borderColor: Brand.primary, backgroundColor: t.cardRaised },
  cardPressed: { opacity: 0.85 },
  tile: { width: TILE, height: TILE, borderRadius: 22, overflow: 'hidden' },
  model: { width: TILE, height: TILE },
  check: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Brand.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  nextTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.primary,
  },
  chevron: { fontSize: 30, lineHeight: 34, paddingHorizontal: 4 },
}));
