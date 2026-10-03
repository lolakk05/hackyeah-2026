import { Pressable, View } from 'react-native';

import type { Landmark } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { Brand, shade } from '@/constants/duo-theme';
import type { StopStatus } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { BounceBubble } from './bounce-bubble';

export const NODE_SIZE = 112;
const EDGE = 8;
const HALO = NODE_SIZE + 28;

/**
 * One stop on the roadmap: a round "coin" with a 3D mini-model inside.
 * current   → coloured, spinning model, bouncing START bubble
 * completed → coloured with a gold check badge
 * locked    → grey
 */
export function RoadmapNode({
  landmark,
  status,
  index,
  bubbleLabel,
  onPress,
}: {
  landmark: Landmark;
  status: StopStatus;
  index: number;
  bubbleLabel?: string;
  onPress: () => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  const locked = status === 'locked';
  const color = locked ? t.locked : landmark.color;
  const edge = locked ? t.lockedDark : shade(landmark.color, 0.22);

  const a11yStatus = status === 'completed' ? 'visited' : status === 'current' ? 'next stop' : 'not yet unlocked';

  return (
    <View style={styles.column}>
      <View style={styles.coinWrap}>
        {status === 'current' ? <View style={[styles.halo, { borderColor: t.soft(landmark.color, 0.55) }]} /> : null}

        <Pressable
          onPress={() => {
            tapFeedback();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${index + 1}: ${landmark.name}, ${a11yStatus}`}
          hitSlop={10}>
          {({ pressed }) => (
            <View style={[styles.coinBase, { backgroundColor: edge }]}>
              <View
                style={[styles.coin, { backgroundColor: color, transform: [{ translateY: pressed ? 0 : -EDGE }] }]}>
                <LandmarkModel
                  kind={landmark.model}
                  backgroundColor={color}
                  animate={status === 'current'}
                  locked={locked}
                  style={styles.model}
                />
              </View>
            </View>
          )}
        </Pressable>

        {status === 'completed' ? (
          <View style={styles.badge} pointerEvents="none">
            <DuoText variant="label" color={Brand.onColor}>
              ✓
            </DuoText>
          </View>
        ) : null}
        {locked ? (
          <View style={[styles.badge, styles.lockBadge]} pointerEvents="none">
            <DuoText style={styles.lockIcon}>🔒</DuoText>
          </View>
        ) : null}

        {bubbleLabel ? (
          <View style={styles.bubbleSlot} pointerEvents="none">
            <BounceBubble label={bubbleLabel} color={landmark.color} />
          </View>
        ) : null}
      </View>

      <View style={[styles.nameChip, locked && styles.nameChipLocked]}>
        <DuoText variant="label" color={locked ? t.lockedText : t.text} numberOfLines={1} style={styles.name}>
          {landmark.name}
        </DuoText>
      </View>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  column: { alignItems: 'center', width: 200 },
  coinWrap: { width: NODE_SIZE, height: NODE_SIZE + EDGE, alignItems: 'center' },
  bubbleSlot: { position: 'absolute', bottom: NODE_SIZE + EDGE + 8, width: 220, alignItems: 'center' },
  halo: {
    position: 'absolute',
    top: -14,
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    borderWidth: 7,
  },
  coinBase: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    marginTop: EDGE,
  },
  coin: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    overflow: 'hidden',
  },
  model: { width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2 },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.yellow,
    borderWidth: 3,
    borderColor: t.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: { backgroundColor: t.lockedDark },
  lockIcon: { fontSize: 14, lineHeight: 18 },
  nameChip: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: t.card,
    borderWidth: 2,
    borderColor: t.border,
    maxWidth: 200,
  },
  nameChipLocked: { backgroundColor: t.surface },
  name: { fontSize: 13, letterSpacing: 0.2 },
}));
