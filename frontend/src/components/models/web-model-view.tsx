/**
 * Web version of ModelView.
 *
 * Browsers allow only ~16 WebGL contexts per page; the oldest one is dropped
 * when there are more (a list of 200 places would lose most of its models, and
 * even the 3D map). So on web ONE shared three.js renderer draws every model,
 * and each view copies the picture into its own plain 2D canvas.
 * Views that are off screen are not drawn at all.
 */
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import { disposeModel, ownMaterials } from './builders';
import type { ModelViewProps } from './model-view';

interface Job {
  /** Draw now? (animated, being dragged, just resized or new). */
  needsFrame: () => boolean;
  draw: (renderer: THREE.WebGLRenderer, t: number) => void;
  visible: boolean;
}

// ─── One renderer + one animation loop for all views ─────────

let shared: THREE.WebGLRenderer | null = null;
const jobs = new Set<Job>();
let looping = false;

function renderer(): THREE.WebGLRenderer {
  if (!shared) {
    shared = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    shared.setPixelRatio(1); // views pass their size in device pixels
  }
  return shared;
}

const start = performance.now();
function loop() {
  if (jobs.size === 0) {
    looping = false;
    return;
  }
  const t = (performance.now() - start) / 1000;
  for (const job of jobs) {
    if (!job.visible || !job.needsFrame()) continue;
    try {
      job.draw(renderer(), t);
    } catch (e) {
      console.log('[ModelView/web] draw failed', e);
    }
  }
  requestAnimationFrame(loop);
}

function addJob(job: Job) {
  jobs.add(job);
  if (!looping) {
    looping = true;
    requestAnimationFrame(loop);
  }
}

// ─── The view ────────────────────────────────────────────────

export function WebModel({ createScene, backgroundColor, motion = 'spin', interactive = false, fallback, style }: ModelViewProps) {
  const host = useRef<View>(null);
  const state = useRef({ drag: 0, lastDx: 0, velocity: 0, paused: false, dirty: 3 });
  const [error, setError] = useState<string | null>(null);

  const focused = useIsFocused();
  useEffect(() => {
    state.current.paused = !focused;
    if (focused) state.current.dirty = Math.max(state.current.dirty, 2);
  }, [focused]);

  const [pan] = useState(() =>
    PanResponder.create({
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

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el?.appendChild) return;
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let built: ReturnType<ModelViewProps['createScene']> | null = null;
    let materials: THREE.Material[] = [];
    let baseRotation = 0;
    let tick: ((t: number) => void) | undefined;
    const animated = motion !== 'none';
    const bg = new THREE.Color(backgroundColor);

    const job: Job = {
      visible: true,
      needsFrame: () => {
        const s = state.current;
        if (s.paused || !built) return false;
        return animated || !!tick || s.dirty > 0 || Math.abs(s.velocity) > 0.0005;
      },
      draw: (r, t) => {
        const s = state.current;
        if (!built || !ctx) return;
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr()));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr()));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          built.camera.aspect = w / h;
          built.camera.updateProjectionMatrix();
        }
        s.drag += s.velocity; // momentum after a drag
        s.velocity *= 0.92;
        const auto = motion === 'spin' ? t * 0.6 : motion === 'sway' ? Math.sin(t * 0.6) * 0.35 : 0;
        built.model.rotation.y = baseRotation + s.drag + auto;
        built.model.position.y = motion === 'spin' ? Math.sin(t * 2) * 0.05 : 0;
        tick?.(t);
        r.setSize(w, h, false);
        r.setClearColor(bg, 1);
        r.render(built.scene, built.camera);
        ctx.drawImage(r.domElement, 0, 0, w, h);
        if (s.dirty > 0) s.dirty -= 1;
      },
    };

    // Build the scene once the view has a size (its aspect ratio sets the camera).
    const build = () => {
      if (built || !canvas.clientWidth || !canvas.clientHeight) return;
      try {
        built = createScene(canvas.clientWidth / canvas.clientHeight);
        materials = ownMaterials(built.model);
        baseRotation = built.model.rotation.y;
        tick = built.model.userData.tick as ((t: number) => void) | undefined;
        state.current.dirty = 2;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    const resize = new ResizeObserver(() => {
      build();
      state.current.dirty = Math.max(state.current.dirty, 2);
    });
    resize.observe(canvas);
    // Only draw what is on screen (long lists).
    const seen = new IntersectionObserver((entries) => {
      job.visible = entries.some((e) => e.isIntersecting);
      if (job.visible) state.current.dirty = Math.max(state.current.dirty, 1);
    });
    seen.observe(canvas);
    build();
    addJob(job);

    return () => {
      jobs.delete(job);
      resize.disconnect();
      seen.disconnect();
      if (built) {
        disposeModel(built.model);
        materials.forEach((m) => m.dispose());
      }
      canvas.remove();
    };
    // Scene settings never change for one view (ModelView remounts it via `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      ref={host}
      style={[styles.wrap, { backgroundColor }, style]}
      {...(interactive ? pan.panHandlers : {})}>
      {error ? (
        <View style={[StyleSheet.absoluteFill, styles.errorBox, { backgroundColor }]}>
          <Text style={styles.emoji}>{fallback}</Text>
        </View>
      ) : null}
    </View>
  );
}

const dpr = () => Math.min(globalThis.devicePixelRatio || 1, 2);

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  errorBox: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 36 },
});
