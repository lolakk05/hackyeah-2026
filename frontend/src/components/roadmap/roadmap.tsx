import { StyleSheet, View } from 'react-native';

import type { Landmark } from '@/api/types';
import { Brand } from '@/constants/duo-theme';
import type { StopStatus } from '@/state/journey-context';
import { useDuo } from '@/state/theme-context';

import { RoadmapNode } from './roadmap-node';

/** Horizontal offsets that make the path snake left and right, Duolingo style. */
const ZIGZAG = [0, 60, 90, 60, 0, -60, -90, -60];
const DOTS_BETWEEN = 3;

export function Roadmap({
  landmarks,
  statusOf,
  bubbleFor,
  onPressStop,
}: {
  landmarks: Landmark[];
  statusOf: (id: string) => StopStatus;
  /** Label for the bouncing bubble (e.g. "START"), or undefined for no bubble. */
  bubbleFor: (landmark: Landmark) => string | undefined;
  onPressStop: (landmark: Landmark) => void;
}) {
  const theme = useDuo();
  return (
    <View style={styles.path}>
      {landmarks.map((lm, i) => {
        const x = ZIGZAG[i % ZIGZAG.length];
        const next = landmarks[i + 1];
        const nextX = ZIGZAG[(i + 1) % ZIGZAG.length];
        const nextDone = next ? statusOf(next.id) !== 'locked' : false;
        return (
          <View key={lm.id} style={styles.row}>
            <View style={{ transform: [{ translateX: x }] }}>
              <RoadmapNode
                landmark={lm}
                index={i}
                status={statusOf(lm.id)}
                bubbleLabel={bubbleFor(lm)}
                onPress={() => onPressStop(lm)}
              />
            </View>
            {next ? (
              <View style={styles.dots} pointerEvents="none">
                {Array.from({ length: DOTS_BETWEEN }, (_, d) => {
                  const t = (d + 1) / (DOTS_BETWEEN + 1);
                  return (
                    <View
                      key={d}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: nextDone ? Brand.yellow : theme.locked,
                          transform: [{ translateX: x + (nextX - x) * t }],
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  path: { alignItems: 'center', paddingTop: 70 },
  row: { alignItems: 'center' },
  dots: { height: 64, justifyContent: 'space-evenly', alignItems: 'center', marginVertical: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
