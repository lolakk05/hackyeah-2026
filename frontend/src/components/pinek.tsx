import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { themedStyles, useDuo } from '@/state/theme-context';

/**
 * Pinek, the Spacer.io mascot (a friendly map pin), in four poses:
 *   wave  · hello (welcome, sign-in)
 *   walk  · on the way (route tips)
 *   cheer · well done (trip complete)
 *   sign  · a question or a heads-up (accessibility questions, the guide)
 * Images are rendered from the AppResources design (assets/images/pinek-*.png).
 */
const POSES = {
  wave: require('../../assets/images/pinek-wave.png'),
  walk: require('../../assets/images/pinek-walk.png'),
  cheer: require('../../assets/images/pinek-cheer.png'),
  sign: require('../../assets/images/pinek-sign.png'),
} as const;

export type PinekPose = keyof typeof POSES;

/** Width / height of the Pinek images. */
const RATIO = 880 / 970;

export function Pinek({
  pose = 'wave',
  size = 120,
  bounce = false,
  style,
}: {
  pose?: PinekPose;
  /** Height in points. */
  size?: number;
  /** Gentle up-and-down float (use sparingly). */
  bounce?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!bounce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -size * 0.04, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, size, y]);

  return (
    <Animated.View style={[{ width: size * RATIO, height: size, transform: [{ translateY: y }] }, style]}>
      <Image
        source={POSES[pose]}
        style={{ width: size * RATIO, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    </Animated.View>
  );
}

/** Pinek with a short speech bubble, for the occasional tip. */
export function PinekTip({ text, pose = 'walk' }: { text: string; pose?: PinekPose }) {
  const t = useDuo();
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={`Pinek: ${text}`}>
      <Pinek pose={pose} size={64} />
      <View style={styles.bubble}>
        <View style={styles.tail} />
        <DuoText variant="body" color={t.text}>
          {text}
        </DuoText>
      </View>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bubble: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: t.radius.lg,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  tail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: t.card,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: t.border,
    transform: [{ rotate: '45deg' }],
  },
}));

const BODY = require('../../assets/images/pinek-wave-body.png');
const ARM = require('../../assets/images/pinek-wave-arm.png');
/** Pinek's right shoulder in the images (the arm turns around it). */
const SHOULDER = '72.73% 52.78%';

/**
 * Pinek standing still and waving hello every few seconds
 * (a real wave: the arm swings, with a tiny hop).
 */
export function WavingPinek({
  size = 170,
  every = 4000,
  style,
}: {
  size?: number;
  /** Time between waves (ms). */
  every?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const arm = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const swing = (to: number, ms: number) =>
      Animated.timing(arm, { toValue: to, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const wave = Animated.parallel([
      Animated.sequence([swing(-1, 180), swing(0.5, 200), swing(-1, 200), swing(0.5, 200), swing(0, 220)]),
      Animated.sequence([
        Animated.timing(hop, { toValue: -size * 0.03, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]);
    // first wave soon after the screen opens, then every few seconds
    const loop = Animated.loop(Animated.sequence([Animated.delay(600), wave, Animated.delay(every)]));
    loop.start();
    return () => loop.stop();
  }, [arm, hop, every, size]);

  const w = size * RATIO;
  const rotate = arm.interpolate({ inputRange: [-1, 1], outputRange: ['-22deg', '22deg'] });
  return (
    <Animated.View
      style={[{ width: w, height: size, transform: [{ translateY: hop }] }, style]}
      accessible={false}>
      <Image source={BODY} style={{ position: 'absolute', width: w, height: size }} resizeMode="contain" />
      <Animated.Image
        source={ARM}
        style={{ position: 'absolute', width: w, height: size, transformOrigin: SHOULDER, transform: [{ rotate }] }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}
