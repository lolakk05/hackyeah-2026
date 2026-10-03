import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ModelKind } from '@/api/types';
import { ENABLE_3D_MODELS } from '@/api/config';

import { disposeModel } from './builders';
import { createThreeRenderer } from './gl-setup';
import { createModelScene } from './scene';

const FALLBACK_EMOJI: Record<ModelKind, string> = {
  barbican: '🏰',
  basilica: '⛪',
  clothhall: '🏛️',
  tower: '🗼',
  castle: '🏯',
  dragon: '🐉',
  synagogue: '🕍',
  bridge: '🌉',
  generic: '📍',
};

interface Props {
  kind: ModelKind;
  /** Colour behind the model (also used as the GL clear colour). */
  backgroundColor: string;
  /** Spin continuously. Static models render once, which saves battery on the roadmap. */
  animate?: boolean;
  /** Grey "locked" version. */
  locked?: boolean;
  /** Let the user drag to spin the model. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A rotating low-poly 3D mini-model of a landmark, rendered with three.js
 * on top of expo-gl (works on iOS, Android and web).
 */
export function LandmarkModel(props: Props) {
  if (!ENABLE_3D_MODELS) {
    return (
      <View style={[styles.fallback, { backgroundColor: props.backgroundColor }, props.style]}>
        <Text style={[styles.emoji, props.locked && { opacity: 0.4 }]}>{FALLBACK_EMOJI[props.kind]}</Text>
      </View>
    );
  }
  // Remount (new GL context) when the model or the locked state changes.
  return <GLModel key={`${props.kind}-${props.locked}-${props.animate}-${props.backgroundColor}`} {...props} />;
}

function GLModel({ kind, backgroundColor, animate = true, locked = false, interactive = false, style }: Props) {
  // Values the render loop reads every frame
  const state = useRef({ drag: 0, lastDx: 0, velocity: 0, disposed: false });

  const cleanup = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const s = state.current;
    // React Strict Mode (dev) mounts → unmounts → mounts again, so reset here.
    s.disposed = false;
    return () => {
      s.disposed = true;
      cleanup.current();
    };
  }, []);

  const [pan] = useState(() =>
    PanResponder.create({
      // Only horizontal drags spin the model; vertical drags still scroll the page.
      onMoveShouldSetPanResponder: (_, g) => interactive && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        state.current.lastDx = 0;
      },
      onPanResponderMove: (_, g) => {
        const delta = (g.dx - state.current.lastDx) * 0.012;
        state.current.lastDx = g.dx;
        state.current.drag += delta;
        state.current.velocity = delta;
      },
    }),
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      setupScene(gl);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[LandmarkModel] 3D failed:', message);
      setError(message);
    }
  };

  const setupScene = (gl: ExpoWebGLRenderingContext) => {
    const { renderer, width, height } = createThreeRenderer(gl, backgroundColor);
    renderer.debug.onShaderError = (_gl, _program, vs, fs) => {
      const log = gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || 'unknown shader error';
      setError(`Shader error: ${log.slice(0, 160)}`);
    };

    const { scene, camera, model } = createModelScene(kind, width / height, locked);
    const baseRotation = model.rotation.y;
    const start = Date.now();
    let frame = 0;
    // Static models still draw a few frames, so the first one isn't lost before the view is shown.
    let warmupFrames = 10;

    const render = () => {
      const s = state.current;
      if (s.disposed) return;
      try {
        const t = (Date.now() - start) / 1000;
        // momentum after a drag
        s.drag += s.velocity;
        s.velocity *= 0.92;
        model.rotation.y = baseRotation + s.drag + (animate ? t * 0.6 : 0);
        model.position.y = animate ? Math.sin(t * 2) * 0.05 : 0;
        renderer.render(scene, camera);
        gl.endFrameEXP?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
      warmupFrames -= 1;
      if (animate || interactive || warmupFrames > 0) frame = requestAnimationFrame(render);
    };
    render();

    cleanup.current = () => {
      cancelAnimationFrame(frame);
      disposeModel(model);
      renderer.dispose();
    };
  };

  return (
    <View style={[styles.wrap, { backgroundColor }, style]} {...(interactive ? pan.panHandlers : {})}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      {error ? (
        // Shown instead of the model so problems are visible on the device.
        <View style={[StyleSheet.absoluteFill, styles.errorBox, { backgroundColor }]}>
          <Text style={styles.emojiSmall}>{FALLBACK_EMOJI[kind]}</Text>
          {__DEV__ ? (
            <Text style={styles.errorText} numberOfLines={4}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 56 },
  errorBox: { alignItems: 'center', justifyContent: 'center', padding: 6 },
  emojiSmall: { fontSize: 36 },
  errorText: { fontSize: 9, color: '#fff', textAlign: 'center' },
});
