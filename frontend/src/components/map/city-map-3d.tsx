import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';

import { MAP_DATA_URL } from '@/api/config';
import type { Landmark } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { createThreeRenderer } from '@/components/models/gl-setup';
import { Brand, theme } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { CameraRig } from '@/map/camera-rig';
import { CITY_PALETTE, createCityScene, type CityScene } from '@/map/city-scene';
import { toLocal, type LatLng } from '@/map/geo';
import { allLandmarkNamePatterns, placeLandmarks, type Placement } from '@/map/landmark-placement';
import { EMPTY_MAP_DATA, loadMapData, type MapData, type OsmBuilding } from '@/map/osm';

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
  /** Whole planned route, drawn as a thin line under the current leg. */
  fullRoute?: LatLng[] | null;
  onPressLandmark?: (id: string) => void;
  ref?: Ref<CityMapHandle>;
}

interface Label {
  id: string;
  x: number;
  y: number;
  name: string;
  state: StopState;
}

interface CityContent {
  data: MapData;
  placements: Placement[];
  buildings: OsmBuilding[];
}

/**
 * Interactive 3D map of Kraków's Old Town.
 * Drag: rotate & tilt · Pinch: zoom · Two fingers: move · Twist: turn · Tap a landmark: open it.
 *
 * The map shows immediately with the landmarks; ordinary buildings appear as
 * soon as they're loaded (usually already prefetched / saved on the phone).
 */
export function CityMap3D({ landmarks, stops, user, route, fullRoute = null, onPressLandmark, ref }: Props) {
  const { s, fmt } = useI18n();
  const [buildingsState, setBuildingsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [labels, setLabels] = useState<Label[]>([]);

  const [rig] = useState(() => new CameraRig());
  const size = useRef({ w: 1, h: 1 });
  const city = useRef<CityScene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const running = useRef(false);
  const content = useRef<CityContent | null>(null);
  const latest = useRef({ stops, user, route, fullRoute });
  useEffect(() => {
    latest.current = { stops, user, route, fullRoute };
  });

  // Landmarks placed without OSM data, so they can be shown right away.
  const contentFor = (data: MapData): CityContent => {
    const { placements, buildings } = placeLandmarks(landmarks, data);
    return { data, placements, buildings };
  };
  const placementById = (id: string) => content.current?.placements.find((p) => p.landmark.id === id);

  const applyContent = () => {
    if (city.current && content.current) {
      const c = content.current;
      city.current.setCity(c.data, c.placements, c.buildings);
    }
  };
  const applyStops = () => {
    const c = city.current;
    if (!c) return;
    c.setStops(
      latest.current.stops.flatMap((st) => {
        const pl = placementById(st.landmark.id);
        return pl
          ? [{ id: st.landmark.id, position: pl.center, height: pl.heightMeters, color: st.landmark.color, state: st.state }]
          : [];
      }),
    );
  };
  const applyUser = () => city.current?.setUser(latest.current.user ? toLocal(latest.current.user) : null);
  const applyRoute = () => city.current?.setRoute(latest.current.route?.map(toLocal) ?? null);
  const applyFullRoute = () => city.current?.setFullRoute(latest.current.fullRoute?.map(toLocal) ?? null);

  // ── Load buildings (usually already prefetched) ──
  const landmarkKey = landmarks.map((l) => l.id).join();
  useEffect(() => {
    let cancelled = false;
    if (!content.current) content.current = contentFor(EMPTY_MAP_DATA);
    applyContent();
    applyStops();
    setBuildingsState('loading');
    loadMapData(allLandmarkNamePatterns(), MAP_DATA_URL)
      .then((data) => {
        if (cancelled) return;
        content.current = contentFor(data);
        applyContent();
        applyStops();
        setBuildingsState('ready');
      })
      .catch(() => !cancelled && setBuildingsState('error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, landmarkKey]);

  useEffect(applyStops, [stops]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applyUser, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applyRoute, [route]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applyFullRoute, [fullRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flyTo: (p, distance) => rig.flyTo(toLocal(p), distance),
    lookAlong: (b) => rig.headingTo(b),
    overview: () => rig.flyTo({ x: 0, z: 250 }, 1700, 0.35, THREE.MathUtils.degToRad(55)),
  }));

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
    try {
      const { renderer, width, height } = createThreeRenderer(gl, CITY_PALETTE.sky);
      const scene = createCityScene(CITY_PALETTE);
      city.current?.dispose();
      city.current = scene;
      const cam = new THREE.PerspectiveCamera(45, width / height, 2, 6000);
      camera.current = cam;
      if (!content.current) content.current = contentFor(EMPTY_MAP_DATA);
      applyContent();
      applyStops();
      applyUser();
      applyRoute();
      applyFullRoute();

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

        // Update the floating name labels ~8 times per second
        if (now - lastLabels > 120) {
          lastLabels = now;
          const next: Label[] = [];
          for (const st of latest.current.stops) {
            const pl = placementById(st.landmark.id);
            if (!pl) continue;
            projected.set(pl.center.x, pl.heightMeters + 34, pl.center.z).project(cam);
            if (projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1) continue;
            next.push({
              id: st.landmark.id,
              x: ((projected.x + 1) / 2) * size.current.w,
              y: ((1 - projected.y) / 2) * size.current.h,
              name: st.landmark.name,
              state: st.state,
            });
          }
          setLabels((prev) => (sameLabels(prev, next) ? prev : next));
        }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      console.warn('[map] 3D failed', e);
      setBuildingsState('error');
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
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gestures}>
        <View style={styles.fill} accessibilityLabel={s.map.a11y} accessible>
          <GLView style={styles.fill} onContextCreate={onContextCreate} />
        </View>
      </GestureDetector>

      {/* Floating name labels above the stops */}
      {labels.map((l) => (
        <Pressable
          key={l.id}
          onPress={() => onPressLandmark?.(l.id)}
          style={[styles.label, { left: l.x - 80, top: l.y - 22 }]}
          accessibilityRole="button"
          accessibilityLabel={
            l.state === 'next'
              ? fmt(s.map.nextStopLabel, { name: l.name })
              : l.state === 'done'
                ? fmt(s.map.visitedLabel, { name: l.name })
                : l.name
          }>
          <View
            style={[
              styles.labelChip,
              l.state === 'next' && styles.labelNext,
              l.state === 'done' && styles.labelDone,
            ]}>
            <DuoText
              variant="caption"
              numberOfLines={1}
              color={l.state === 'next' ? Brand.onPrimary : l.state === 'done' ? theme.textMuted : theme.text}
              style={styles.labelText}>
              {l.state === 'done' ? '✓ ' : ''}
              {l.name}
            </DuoText>
          </View>
        </Pressable>
      ))}

      {/* Small, non-blocking status chip while buildings load */}
      {buildingsState !== 'ready' ? (
        <Pressable
          style={styles.status}
          disabled={buildingsState !== 'error'}
          onPress={() => {
            tapFeedback();
            setReloadKey((k) => k + 1);
          }}
          accessibilityRole={buildingsState === 'error' ? 'button' : 'text'}>
          {buildingsState === 'loading' ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
          <DuoText variant="caption" color={theme.text}>
            {buildingsState === 'loading' ? s.map.loadingBuildings : `${s.map.buildingsError} · ${s.common.tryAgain}`}
          </DuoText>
        </Pressable>
      ) : null}
    </View>
  );
}

function sameLabels(a: Label[], b: Label[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].state !== b[i].state || a[i].name !== b[i].name) return false;
    if (Math.abs(a[i].x - b[i].x) > 1.5 || Math.abs(a[i].y - b[i].y) > 1.5) return false;
  }
  return true;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: CITY_PALETTE.sky },
  label: { position: 'absolute', width: 160, alignItems: 'center' },
  labelChip: {
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  labelNext: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  labelDone: { opacity: 0.85 },
  labelText: { fontWeight: '700' },
  status: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
});
