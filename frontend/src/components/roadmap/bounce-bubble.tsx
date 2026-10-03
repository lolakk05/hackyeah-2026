import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { DuoText } from '@/components/duo/duo-text';
import { Brand } from '@/constants/duo-theme';
import { themedStyles } from '@/state/theme-context';

/** The bouncing "START" speech bubble above the current roadmap node. */
export function BounceBubble({ label, color = Brand.green }: { label: string; color?: string }) {
  const styles = useStyles();
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [y]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.wrap, animated]} pointerEvents="none">
      <View style={styles.bubble}>
        <DuoText variant="label" color={color}>
          {label}
        </DuoText>
      </View>
      <View style={styles.arrow} />
    </Animated.View>
  );
}

const useStyles = themedStyles((t) => ({
  wrap: { alignItems: 'center' },
  bubble: {
    backgroundColor: t.card,
    borderWidth: 2,
    borderColor: t.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  arrow: {
    width: 14,
    height: 14,
    backgroundColor: t.card,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: t.border,
    transform: [{ rotate: '45deg' }],
    marginTop: -8,
  },
}));
