import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';

import { MAP_DATA_URL } from '@/api/config';
import type { Landmark } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { createThreeRenderer } from '@/components/models/gl-setup';
import { Brand } from '@/constants/duo-theme';
import { CameraRig } from '@/map/camera-rig';
import { createCityScene, DAY_PALETTE, NIGHT_PALETTE, type CityScene } from '@/map/city-scene';
import { toLocal, type LatLng } from '@/map/geo';
import { allLandmarkNamePatterns, placeLandmarks, type Placement } from '@/map/landmark-placement';
import { loadMapData } from '@/map/osm';
import { useDuo } from '@/state/theme-context';

export type StopState = 'done' | 'next' | 'later';

export interface CityMapHandle {
  /** Glide the camera to a point. distance in metres from the camera to the point. */
  flyTo: (p: LatLng, distance?: number) => void;
  /** Turn the camera to look along a compass bearing. */
  lookAlong: (bearingDegrees: number) => void;
  overview: () => void;
}

interface Props {
  /** Every landmark to show as a 3D model. */
  landmarks: Landmark[];
  /** Route stops and their state, for the pins and labels. */
  stops: { landmark: Landmark; state: StopState }[];
  user: LatLng | null;
  /** Walking route to draw (from the user to the next stop). */
  route: LatLng[] | null;
  onPressLandmark?: (id: string) => void;
  ref?: Ref<CityMapHandle>;
}

interface Label {
  id: string;
  x: number;
  y: number;
  name: string;
  state: StopState;
  color: string;
}

/**
 * Interactive 3D map of Kraków's Old Town.
 * Drag: rotate & tilt · Pinch: zoom · Two fingers: move · Twist: turn · Tap a landmark: open it.
 */
export function CityMap3D({ landmarks, stops, user, route, onPressLandmark, ref }: Props) {
  const t = useDuo();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [placed, setPlaced] = useState<{
    data: Awaited<ReturnType<typeof loadMapData>>;
    placements: Placement[];
    buildings: ReturnType<typeof placeLandmarks>['buildings'];
  } | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);

  const [rig] = useState(() => new CameraRig());
  const size = useRef({ w: 1, h: 1 });
  const city = useRef<CityScene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const running = useRef(false);
  const latest = useRef({ stops, user, route });
  useEffect(() => {
    latest.current = { stops, user, route };
  });

  // ── Load OSM data and place landmarks ──
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    loadMapData(allLandmarkNamePatterns(), MAP_DATA_URL)
      .then((data) => {
        if (cancelled) return;
        const { placements, buildings } = placeLandmarks(landmarks, data);
        setPlaced({ data, placements, buildings });
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, landmarks.map((l) => l.id).join()]);

  // ── Push prop changes into the live scene ──
  const placementById = (id: string) => placed?.placements.find((p) => p.landmark.id === id);
  const applyStops = () => {
    const c = city.current;
    if (!c || !placed) return;
    c.setStops(
      latest.current.stops.flatMap((s) => {
        const pl = placementById(s.landmark.id);
        return pl
          ? [{ id: s.landmark.id, position: pl.center, height: pl.heightMeters, color: s.landmark.color, state: s.state }]
          : [];
      }),
    );
  };
  const applyUser = () => city.current?.setUser(latest.current.user ? toLocal(latest.current.user) : null);
  const applyRoute = () => city.current?.setRoute(latest.current.route?.map(toLocal) ?? null);

  useEffect(applyStops, [stops, placed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applyUser, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applyRoute, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flyTo: (p, distance) => rig.flyTo(toLocal(p), distance),
    lookAlong: (b) => rig.headingTo(b),
    overview: () => rig.flyTo({ x: 0, z: 250 }, 1700, 0.35, THREE.MathUtils.degToRad(55)),
  }));

  // Stop the render loop when unmounted
  useEffect(() => {
    running.current = true;
    return () => {
      running.current = false;
      city.current?.dispose();
      city.current = null;
    };
  }, []);

  // ── GL setup + render loop ──
  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    if (!placed) return;
    try {
      const { renderer, width, height } = createThreeRenderer(gl, t.dark ? NIGHT_PALETTE.sky : DAY_PALETTE.sky);
      const scene = createCityScene(
        placed.data,
        placed.placements,
        placed.buildings,
        t.dark ? NIGHT_PALETTE : DAY_PALETTE,
      );
      city.current?.dispose();
      city.current = scene;
      const cam = new THREE.PerspectiveCamera(45, width / height, 2, 6000);
      camera.current = cam;
      applyStops();
      applyUser();
      applyRoute();

      const start = Date.now();
      let lastLabels = 0;
      const projected = new THREE.Vector3();
      const loop = () => {
        if (!running.current || city.current !== scene) {
          renderer.dispose();
          return;
        }
        const now = Date.now();
        rig.update(cam);
        scene.tick((now - start) / 1000);
        renderer.render(scene.scene, cam);
        gl.endFrameEXP?.();

        // Update the name labels ~8 times per second
        if (now - lastLabels > 120) {
          lastLabels = now;
          const next: Label[] = [];
          for (const s of latest.current.stops) {
            const pl = placementById(s.landmark.id);
            if (!pl) continue;
            projected.set(pl.center.x, pl.heightMeters + 34, pl.center.z).project(cam);
            if (projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1) continue;
            next.push({
              id: s.landmark.id,
              x: ((projected.x + 1) / 2) * size.current.w,
              y: ((1 - projected.y) / 2) * size.current.h,
              name: s.landmark.name,
              state: s.state,
              color: s.landmark.color,
            });
          }
          setLabels((prev) => (sameLabels(prev, next) ? prev : next));
        }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  // ── Gestures ──
  const pick = (x: number, y: number) => {
    const cam = camera.current;
    const c = city.current;
    if (!cam || !c || !onPressLandmark) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / size.current.w) * 2 - 1, -(y / size.current.h) * 2 + 1), cam);
    const hits = ray.intersectObjects([...c.landmarkObjects.values()], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.landmarkId) o = o.parent;
      if (o) return onPressLandmark(o.userData.landmarkId as string);
    }
  };

  const oneFinger = Gesture.Pan()
    .maxPointers(1)
    .runOnJS(true)
    .onChange((e) => rig.rotateBy(e.changeX, e.changeY));
  const twoFingers = Gesture.Pan()
    .minPointers(2)
    .runOnJS(true)
    .onChange((e) => rig.panBy(e.changeX, e.changeY, size.current.h));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onChange((e) => rig.zoomBy(e.scaleChange));
  const twist = Gesture.Rotation()
    .runOnJS(true)
    .onChange((e) => rig.twistBy(e.rotationChange));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => pick(e.x, e.y));
  const gestures = Gesture.Simultaneous(Gesture.Exclusive(oneFinger, tap), twoFingers, pinch, twist);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View style={[styles.fill, { backgroundColor: t.dark ? NIGHT_PALETTE.sky : DAY_PALETTE.sky }]} onLayout={onLayout}>
      {status === 'ready' && placed ? (
        <GestureDetector gesture={gestures}>
          <View style={styles.fill} accessibilityLabel="3D map of Kraków Old Town" accessible>
            <GLView key={`${reloadKey}-${t.dark}`} style={styles.fill} onContextCreate={onContextCreate} />
          </View>
        </GestureDetector>
      ) : null}

      {/* Floating name labels above the stops */}
      {labels.map((l) => (
        <Pressable
          key={l.id}
          onPress={() => onPressLandmark?.(l.id)}
          style={[styles.label, { left: l.x - 80, top: l.y - 22 }]}
          accessibilityRole="button"
          accessibilityLabel={`${l.name}${l.state === 'next' ? ', next stop' : l.state === 'done' ? ', visited' : ''}`}>
          <View
            style={[
              styles.labelChip,
              {
                backgroundColor: l.state === 'next' ? l.color : t.card,
                borderColor: l.state === 'next' ? l.color : t.border,
              },
            ]}>
            <DuoText
              variant="caption"
              numberOfLines={1}
              color={l.state === 'next' ? Brand.onColor : l.state === 'done' ? t.textMuted : t.text}>
              {l.state === 'done' ? '✓ ' : ''}
              {l.name}
            </DuoText>
          </View>
        </Pressable>
      ))}

      {status === 'loading' ? (
        <View style={[styles.center, StyleSheet.absoluteFill]}>
          <ActivityIndicator size="large" color={Brand.green} />
          <DuoText variant="body" color={t.textMuted}>
            Building Kraków in 3D…
          </DuoText>
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={[styles.center, StyleSheet.absoluteFill]}>
          <DuoText variant="heading">😕 Couldn’t load the 3D map</DuoText>
          <DuoText variant="caption" color={t.textMuted} style={styles.errorText}>
            {error}
          </DuoText>
          <DuoButton title="Try again" variant="blue" size="md" onPress={() => setReloadKey((k) => k + 1)} />
        </View>
      ) : null}
    </View>
  );
}

function sameLabels(a: Label[], b: Label[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].state !== b[i].state) return false;
    if (Math.abs(a[i].x - b[i].x) > 1.5 || Math.abs(a[i].y - b[i].y) > 1.5) return false;
  }
  return true;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { textAlign: 'center' },
  label: { position: 'absolute', width: 160, alignItems: 'center' },
  labelChip: {
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
  },
});
