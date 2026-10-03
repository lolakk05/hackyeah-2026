import { View } from 'react-native';

import type { Landmark } from '@/api/types';
import { Brand } from '@/constants/duo-theme';
import type { StopStatus } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { CARD_PADDING, RoadmapNode, TILE } from './roadmap-node';

/** The route as a vertical timeline of stop cards joined by a path line. */
export function Roadmap({
  landmarks,
  statusOf,
  onPressStop,
}: {
  landmarks: Landmark[];
  statusOf: (id: string) => StopStatus;
  onPressStop: (landmark: Landmark) => void;
}) {
  const theme = useDuo();
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {landmarks.map((lm, i) => {
        const next = landmarks[i + 1];
        const reached = next ? statusOf(next.id) !== 'locked' : false;
        return (
          <View key={lm.id}>
            <RoadmapNode landmark={lm} index={i} status={statusOf(lm.id)} onPress={() => onPressStop(lm)} />
            {next ? (
              <View style={[styles.connector, { backgroundColor: reached ? Brand.success : theme.border }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = themedStyles(() => ({
  list: { paddingTop: 8 },
  connector: {
    width: 4,
    height: 22,
    borderRadius: 2,
    // centred under the 3D tile (card border is 1.5)
    marginLeft: CARD_PADDING + 1.5 + TILE / 2 - 2,
  },
}));
