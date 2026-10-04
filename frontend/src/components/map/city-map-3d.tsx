import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useIsFocused } from 'expo-router';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, MouseButton } from 'react-native-gesture-handler';
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
import { MAP_EXTENT, toLocal, type LatLng } from '@/map/geo';
import { allLandmarkNamePatterns, placeLandmarks, type Placement } from '@/map/landmark-placement';
import { EMPTY_MAP_DATA, loadMapData, type MapData, type OsmBuilding } from '@/map/osm';
import { buildPresentation } from '@/map/presentation';

export type StopState = 'done' | 'next' | 'later';

/** A reported problem shown on the map. */
export interface MapIssue {
  id: string;
  coordinates: LatLng;
  severity: 'info' | 'hard' | 'blocked';
}

export interface CityMapHandle {
  /** Glide the camera to a point. distance in metres from the camera to the point. */
  flyTo: (p: LatLng, distance?: number) => void;
  /** Turn the camera to look along a compass bearing. */
  lookAlong: (bearingDegrees: number) => void;
  overview: () => void;
  /** Glide to a reported problem and make its sign bigger (null = none). */
  focusIssue: (id: string | null) => void;
  /**
   * Presentation mode: a 40 s camera show (fly-overs, orbits, zooms) along the
   * route stops, then back to the previous view. onEnd runs when it finishes or
   * is stopped (touching the map stops it).
   */
  playPresentation: (onEnd: () => void) => void;
  stopPresentation: () => void;
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
  /** Reported problems (warning signs). */
  issues?: MapIssue[];
  onPressLandmark?: (id: string) => void;
  onPressIssue?: (id: string) => void;
  ref?: Ref<CityMapHandle>;
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
export function CityMap3D({
  landmarks,
  stops,
  user,
  route,
  fullRoute = null,
  issues = NO_ISSUES,
  onPressLandmark,
  onPressIssue,
  ref,
}: Props) {
  const { s, fmt } = useI18n();
  const [buildingsState, setBuildingsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * Label positions: moved every rendered frame straight from the render loop
   * (Animated values, no React re-render), so they stay glued to the 3D map.
   */
  const labelPos = useRef(new Map<string, Animated.ValueXY>());
  const labelXY = (id: string) => {
    let v = labelPos.current.get(id);
    if (!v) labelPos.current.set(id, (v = new Animated.ValueXY({ x: -9999, y: -9999 })));
    return v;
  };

  const [rig] = useState(() => new CameraRig());
  /** Camera view before zooming to a reported problem. */
  const savedView = useRef<CameraRig['goal'] | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const city = useRef<CityScene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  // true from the start: on web the GL context (and the first frame) comes before the effects run
  const running = useRef(true);
  const content = useRef<CityContent | null>(null);
  const latest = useRef({ stops, user, route, fullRoute, issues });
  useEffect(() => {
    latest.current = { stops, user, route, fullRoute, issues };
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
  const applyIssues = () =>
    city.current?.setIssues(
      latest.current.issues.map((i) => ({ id: i.id, position: toLocal(i.coordinates), severity: i.severity })),
    );

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
  useEffect(applyIssues, [issues]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flyTo: (p, distance) => rig.flyTo(toLocal(p), distance),
    lookAlong: (b) => rig.headingTo(b),
    overview: () => rig.flyTo(MAP_EXTENT.center, 2500, 0.35, THREE.MathUtils.degToRad(55)),
    playPresentation: (onEnd) => {
      city.current?.highlightIssue(null);
      savedView.current = null;
      const before = rig.saveView();
      const stopsInOrder = latest.current.stops.map((st) => st.landmark.coordinates);
      rig.playShow(buildPresentation(stopsInOrder, rig.azimuth), (finished) => {
        if (finished) rig.restoreView(before); // glide back to where you were
        onEnd();
      });
    },
    stopPresentation: () => rig.stopShow(),
    focusIssue: (id) => {
      city.current?.highlightIssue(id);
      const issue = id ? latest.current.issues.find((i) => i.id === id) : null;
      if (issue) {
        // remember the view from before the first zoom (not when hopping between signs)
        savedView.current ??= rig.saveView();
        // close enough to see it well; a steeper tilt so the card at the bottom doesn't hide it
        rig.flyTo(toLocal(issue.coordinates), 230, undefined, THREE.MathUtils.degToRad(52));
      } else if (savedView.current) {
        rig.restoreView(savedView.current); // back to where you were
        savedView.current = null;
      }
    },
  }));

  // Stop drawing while a place page covers the map; start again when it's back.
  const paused = useRef(false);
  const resume = useRef<() => void>(() => {});
  const focused = useIsFocused();
  useEffect(() => {
    paused.current = !focused;
    if (focused) resume.current();
  }, [focused]);

  useEffect(() => {
    running.current = true;
    return () => {
      running.current = false;
      rig.stopShow();
      resume.current(); // a paused loop runs once more to free the renderer
      city.current?.dispose();
      city.current = null;
    };
  }, []);

  // ── GL setup + render loop ──
  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const { renderer, width, height, fit } = createThreeRenderer(gl, CITY_PALETTE.sky);
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
      applyIssues();

      const start = Date.now();
      let frame = 0;
      let idle = false;
      const projected = new THREE.Vector3();
      const loop = () => {
        if (!running.current || city.current !== scene) {
          renderer.dispose();
          return;
        }
        if (paused.current) {
          idle = true; // resume() starts the loop again
          return;
        }
        const now = Date.now();
        frame += 1;
        // While the camera is still, only small markers move: draw every other
        // frame (30 fps) to save battery and keep the phone cool.
        const resized = fit(cam); // web: follow the browser window size
        const settled = rig.isSettled() && !resized;
        rig.update(cam);
        if (!settled || frame % 2 === 0) {
          scene.tick((now - start) / 1000);
          renderer.render(scene.scene, cam);
          gl.endFrameEXP?.();

          // Move the name labels in the same frame as the 3D picture
          for (const st of latest.current.stops) {
            const pl = placementById(st.landmark.id);
            const xy = labelXY(st.landmark.id);
            if (!pl) continue;
            projected.set(pl.center.x, pl.heightMeters + 34, pl.center.z).project(cam);
            const off = projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1;
            const x = off ? -9999 : ((projected.x + 1) / 2) * size.current.w - 80; // off screen = not tappable
            const y = off ? -9999 : ((1 - projected.y) / 2) * size.current.h - 22;
            const last = xy as unknown as { _lx?: number; _ly?: number };
            // Skip when nothing moved (the camera is still)
            if (Math.abs((last._lx ?? 1e9) - x) < 0.3 && Math.abs((last._ly ?? 1e9) - y) < 0.3) continue;
            last._lx = x;
            last._ly = y;
            xy.setValue({ x, y });
          }
        }
        requestAnimationFrame(loop);
      };
      resume.current = () => {
        if (idle) {
          idle = false;
          requestAnimationFrame(loop);
        }
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
    if (!cam || !c) return;
    // Warning signs are small: pick the nearest one on screen within a finger's reach.
    if (onPressIssue && latest.current.issues.length) {
      let best: { id: string; d: number } | null = null;
      const v = new THREE.Vector3();
      for (const issue of latest.current.issues) {
        const p = toLocal(issue.coordinates);
        v.set(p.x, 26, p.z).project(cam);
        if (v.z > 1) continue;
        const sx = ((v.x + 1) / 2) * size.current.w;
        const sy = ((1 - v.y) / 2) * size.current.h;
        const d = Math.hypot(sx - x, sy - y);
        if (d < 34 && (!best || d < best.d)) best = { id: issue.id, d };
      }
      if (best) return onPressIssue(best.id);
    }
    if (!onPressLandmark) return;
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
    .mouseButton(MouseButton.LEFT)
    .runOnJS(true)
    .onChange((e) => rig.rotateBy(e.changeX, e.changeY));
  // Web: drag with the right (or middle) mouse button to move the map
  const mousePan = Gesture.Pan()
    .mouseButton(MouseButton.RIGHT | MouseButton.MIDDLE)
    .runOnJS(true)
    .onChange((e) => rig.panBy(e.changeX, e.changeY, size.current.h));
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
  const gestures = Gesture.Simultaneous(Gesture.Exclusive(oneFinger, tap), mousePan, twoFingers, pinch, twist);

  // Web: mouse wheel / trackpad pinch zooms; no browser menu on right-click.
  const surface = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = surface.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // trackpad pinch arrives as wheel + ctrlKey, with smaller deltas
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      rig.zoomBy(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    const noMenu = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', noMenu);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', noMenu);
    };
  }, [rig]);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gestures}>
        <View ref={surface} style={styles.fill} accessibilityLabel={s.map.a11y} accessible>
          <GLView style={styles.fill} onContextCreate={onContextCreate} msaaSamples={2} />
        </View>
      </GestureDetector>

      {/* Floating name labels above the stops */}
      {stops.map(({ landmark, state }) => ({ id: landmark.id, name: landmark.name, state })).map((l) => (
        <AnimatedPressable
          key={l.id}
          onPress={() => onPressLandmark?.(l.id)}
          style={[styles.label, { transform: labelXY(l.id).getTranslateTransform() }]}
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
        </AnimatedPressable>
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

const NO_ISSUES: MapIssue[] = [];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: CITY_PALETTE.sky },
  label: { position: 'absolute', left: 0, top: 0, width: 160, alignItems: 'center' },
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
