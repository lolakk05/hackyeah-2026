import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ENABLE_3D_MODELS } from '@/api/config';

import { disposeModel, ownMaterials } from './builders';
import { createThreeRenderer } from './gl-setup';
import type { ModelScene } from './scene';
import { WebModel } from './web-model-view';

export type ModelMotion = 'spin' | 'sway' | 'none';

export interface ModelViewProps {
  /** Build the scene for the view's aspect ratio. */
  createScene: (aspect: number) => ModelScene;
  /** Change this to rebuild the model (new GL context). */
  sceneKey: string;
  /** Colour behind the model (also the GL clear colour). */
  backgroundColor: string;
  /** spin: turn and float · sway: rock gently · none: still (drawn once, saves battery). */
  motion?: ModelMotion;
  /** Let the user drag to spin the model. */
  interactive?: boolean;
  /** Shown instead of 3D when models are off or WebGL fails. */
  fallback: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A small three.js view on expo-gl, used by the landmark models, statues,
 * trophies, the ranking podium and the statue shelf.
 * A model can animate its own parts with `model.userData.tick(seconds)`.
 */
export function ModelView(props: ModelViewProps) {
  if (!ENABLE_3D_MODELS) {
    return (
      <View style={[styles.fallback, { backgroundColor: props.backgroundColor }, props.style]}>
        <Text style={styles.emoji}>{props.fallback}</Text>
      </View>
    );
  }
  const key = `${props.sceneKey}-${props.motion}-${props.backgroundColor}`;
  // Web: one shared WebGL renderer for all models (browsers drop extra contexts).
  if (Platform.OS === 'web') return <WebModel key={key} {...props} />;
  return <GLModel key={key} {...props} />;
}

function GLModel({ createScene, backgroundColor, motion = 'spin', interactive = false, fallback, style }: ModelViewProps) {
  // Values the render loop reads every frame
  const state = useRef({ drag: 0, lastDx: 0, velocity: 0, disposed: false, paused: false });
  const cleanup = useRef<() => void>(() => {});
  /** Restarts the render loop after a pause (set once the scene exists). */
  const resume = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);

  // Stop drawing while another screen covers this one (saves battery, keeps the map smooth).
  const focused = useIsFocused();
  useEffect(() => {
    state.current.paused = !focused;
    if (focused) resume.current();
  }, [focused]);

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
      const { renderer, width, height, fit } = createThreeRenderer(gl, backgroundColor);
      renderer.debug.onShaderError = (_gl, _program, vs, fs) => {
        const log = gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || 'unknown shader error';
        setError(`Shader error: ${log.slice(0, 160)}`);
      };
      const { scene, camera, model } = createScene(width / height);
      const materials = ownMaterials(model);
      const tick = model.userData.tick as ((t: number) => void) | undefined;
      const baseRotation = model.rotation.y;
      const start = Date.now();
      let frame = 0;
      // Still models draw a few frames, so the first one isn't lost before the view is shown.
      let warmupFrames = 10;
      const animated = motion !== 'none' || !!tick;
      let idle = false;

      const render = () => {
        const s = state.current;
        if (s.disposed) return;
        if (s.paused) {
          idle = true; // resume() starts the loop again
          return;
        }
        try {
          const t = (Date.now() - start) / 1000;
          s.drag += s.velocity; // momentum after a drag
          s.velocity *= 0.92;
          const auto = motion === 'spin' ? t * 0.6 : motion === 'sway' ? Math.sin(t * 0.6) * 0.35 : 0;
          model.rotation.y = baseRotation + s.drag + auto;
          model.position.y = motion === 'spin' ? Math.sin(t * 2) * 0.05 : 0;
          tick?.(t);
          // web: the canvas got its real size → match it and draw a few more frames
          if (fit(camera)) warmupFrames = Math.max(warmupFrames, 3);
          renderer.render(scene, camera);
          gl.endFrameEXP?.();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return;
        }
        warmupFrames -= 1;
        if (animated || interactive || warmupFrames > 0) frame = requestAnimationFrame(render);
      };
      resume.current = () => {
        if (idle && !state.current.disposed) {
          idle = false;
          frame = requestAnimationFrame(render);
        }
      };
      render();

      // Web: a still model stops drawing; redraw it when the page layout resizes the canvas.
      const domCanvas = (gl as unknown as { canvas?: HTMLCanvasElement }).canvas;
      let observer: ResizeObserver | null = null;
      if (domCanvas && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          if (state.current.disposed || state.current.paused || animated || interactive) return;
          cancelAnimationFrame(frame);
          warmupFrames = Math.max(warmupFrames, 3);
          frame = requestAnimationFrame(render);
        });
        observer.observe(domCanvas);
      }

      cleanup.current = () => {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        disposeModel(model);
        materials.forEach((m) => m.dispose());
        renderer.dispose();
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[ModelView] 3D failed:', message);
      setError(message);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor }, style]} {...(interactive ? pan.panHandlers : {})}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      {error ? (
        // Shown instead of the model so problems are visible on the device.
        <View style={[StyleSheet.absoluteFill, styles.errorBox, { backgroundColor }]}>
          <Text style={styles.emojiSmall}>{fallback}</Text>
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
