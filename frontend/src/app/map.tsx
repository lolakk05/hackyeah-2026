import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchWalkingRoute } from '@/api/client';
import type { LatLng, WalkingRoute } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { arriveFeedback, tapFeedback } from '@/components/duo/haptics';
import { CityMap3D, type CityMapHandle, type MapIssue, type StopState } from '@/components/map/city-map-3d';
import { IssueCard } from '@/components/reports/issue-card';
import { ReportSheet, type ReportPlace } from '@/components/reports/report-sheet';
import { Brand } from '@/constants/duo-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useI18n } from '@/i18n/language-context';
import { bearingDegrees, distanceMeters, formatDistance } from '@/map/geo';
import { useJourney } from '@/state/journey-context';
import { useReports } from '@/state/reports-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Within this distance you can tap "I'm here". */
const ARRIVED_METERS = 40;
/** Demo position for the first leg when GPS isn't available: the Main Square. */
const MAIN_SQUARE: LatLng = { latitude: 50.0614, longitude: 19.9366 };

/** 3D map with navigation from your position to the next stop of the route. */
export default function MapScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const j = useJourney();
  const mapRef = useRef<CityMapHandle>(null);

  const stops = j.roadmap;
  // Route stops first, then up to 40 other places as 3D models (more would slow the map down).
  const mapLandmarks = useMemo(() => {
    const ids = new Set(stops.map((st) => st.id));
    return [...stops, ...j.landmarks.filter((l) => !ids.has(l.id)).slice(0, 40)];
  }, [stops, j.landmarks]);
  const nextStop = stops.find((st) => st.id === j.currentId) ?? null;
  const nextIndex = nextStop ? stops.indexOf(nextStop) : -1;
  // Fallback position when GPS isn't available or you're not in Kraków:
  // the previous stop (or a spot on the Main Square for the first leg).
  const previousStop = nextIndex > 0 ? stops[nextIndex - 1] : null;
  const location = useUserLocation(previousStop?.coordinates ?? MAIN_SQUARE);
  const me = location.position;

  // ── Problem reports on the map ──
  const reports = useReports();
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [reportPlace, setReportPlace] = useState<ReportPlace | null>(null);
  useEffect(() => {
    reports.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mapIssues = useMemo<MapIssue[]>(
    () =>
      reports.issues
        .filter((i) => i.location && Number.isFinite(i.location.latitude))
        .map((i) => ({
          id: i.id,
          coordinates: i.location,
          severity: i.severity === 'blocked' || i.severity === 'info' ? i.severity : 'hard',
        })),
    [reports.issues],
  );
  const selected = reports.issues.find((i) => i.id === selectedIssue) ?? null;

  // ── Presentation mode: a 40 s camera show over the city, UI stays on screen ──
  const [presenting, setPresenting] = useState(false);
  const togglePresentation = () => {
    if (presenting) {
      mapRef.current?.stopPresentation();
      return;
    }
    setSelectedIssue(null);
    mapRef.current?.focusIssue(null);
    setPresenting(true);
    mapRef.current?.playPresentation(() => setPresenting(false));
  };

  const openReport = () => {
    if (!me) return;
    const gps = location.source === 'gps';
    // The stop you are at (within 80 m), if any.
    const nearStop = stops.find((st) => distanceMeters(st.coordinates, me) < 80);
    setSelectedIssue(null);
    mapRef.current?.focusIssue(null);
    setReportPlace({
      location: me,
      locationSource: gps ? 'gps' : 'map',
      landmarkId: nearStop?.id,
      landmarkName: nearStop?.name,
      segment: nextStop ? { fromStopId: previousStop?.id ?? null, toStopId: nextStop.id } : undefined,
      label: gps ? s.issues.myLocation : previousStop ? fmt(s.issues.near, { name: previousStop.name }) : s.issues.mapCenter,
    });
  };

  // The planner's walking path into the next stop (Route Finder legs), if any.
  const plannedLeg = j.plan?.route?.legs.find((l) => l.toId === nextStop?.id && l.path.length > 1);

  // ── Walking route from me to the next stop ──
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const routeFrom = useRef<typeof me>(null);
  /** Stop id of the routing request in flight (one at a time, never cancelled by GPS updates). */
  const routing = useRef<string | null>(null);
  const currentStopId = useRef<string | null>(null);
  currentStopId.current = nextStop?.id ?? null;
  useEffect(() => {
    if (!me || !nextStop) {
      setRoute(null);
      return;
    }
    // Follow the planned route line when we're on it (or have no real GPS).
    if (plannedLeg && (location.source !== 'gps' || distanceToPath(me, plannedLeg.path) < 80)) {
      setRoute({
        path: plannedLeg.path,
        distanceMeters: plannedLeg.distanceMeters,
        durationMinutes: plannedLeg.durationMinutes,
        source: 'api',
      });
      routeFrom.current = null;
      return;
    }
    // Only re-route when we moved more than 25 m (or the stop changed),
    // and never while a request for this stop is still running.
    if (routing.current === nextStop.id) return;
    if (
      route &&
      routeFrom.current &&
      distanceMeters(routeFrom.current, me) < 25 &&
      route.path.at(-1) === nextStop.coordinates
    )
      return;
    routeFrom.current = me;
    const stop = nextStop;
    routing.current = stop.id;
    fetchWalkingRoute(me, stop.coordinates, j.preferences.needs).then((r) => {
      if (routing.current === stop.id) routing.current = null;
      if (currentStopId.current !== stop.id) return; // the next stop changed meanwhile
      const path = [...r.path.slice(0, -1), stop.coordinates];
      setRoute({ ...r, path });
      // Remember the walked section, for the accessibility question on arrival.
      j.setLegPath(stop.id, path);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.latitude, me?.longitude, nextStop?.id, plannedLeg?.toId]);

  // ── Camera: show me + the next stop when the leg starts ──
  useEffect(() => {
    if (!me || !nextStop) return;
    const mid = {
      latitude: (me.latitude + nextStop.coordinates.latitude) / 2,
      longitude: (me.longitude + nextStop.coordinates.longitude) / 2,
    };
    const d = distanceMeters(me, nextStop.coordinates);
    const timer = setTimeout(() => {
      mapRef.current?.flyTo(mid, Math.max(260, d * 1.8));
      mapRef.current?.lookAlong(bearingDegrees(me, nextStop.coordinates));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextStop?.id, !!me]);

  const mapStops = useMemo(
    () =>
      stops.map((st) => ({
        landmark: st,
        state: (j.completedIds.includes(st.id) ? 'done' : st.id === j.currentId ? 'next' : 'later') as StopState,
      })),
    [stops, j.completedIds, j.currentId],
  );

  const straight = me && nextStop ? distanceMeters(me, nextStop.coordinates) : null;
  // Distance still to walk along the route line (falls back to the straight line).
  const remaining = me && route && route.path.length > 1 ? remainingAlong(route.path, me) : (straight ?? 0);
  const remainingMinutes =
    route && route.distanceMeters > 0
      ? Math.max(1, Math.round((route.durationMinutes * remaining) / route.distanceMeters))
      : route?.durationMinutes;
  const arrived = straight !== null && straight < ARRIVED_METERS;
  // Buzz once when you get close to the next stop
  const buzzedFor = useRef<string | null>(null);
  useEffect(() => {
    if (arrived && nextStop && buzzedFor.current !== nextStop.id) {
      buzzedFor.current = nextStop.id;
      arriveFeedback();
    }
  }, [arrived, nextStop]);
  const bearing = me && nextStop ? bearingDegrees(me, nextStop.coordinates) : 0;
  const direction = s.map.directions[Math.round(bearing / 45) % 8];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/roadmap'));
  const openStop = (id: string) => router.push({ pathname: '/place/[id]', params: { id } });
  const navLine = arrived
    ? s.map.arrived
    : fmt(s.map.nav, { dist: formatDistance(remaining), min: remainingMinutes ?? '…', dir: direction });

  return (
    <View style={styles.root}>
      <CityMap3D
        ref={mapRef}
        landmarks={mapLandmarks}
        stops={mapStops}
        user={me}
        route={route?.path ?? null}
        fullRoute={j.plan?.route?.path ?? null}
        issues={mapIssues}
        onPressLandmark={openStop}
        onPressIssue={(id) => {
          tapFeedback();
          setSelectedIssue(id);
          mapRef.current?.focusIssue(id);
        }}
      />

      {/* Top: navigation card */}
      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.topRow}>
          <RoundButton label="←" onPress={close} a11y={s.map.backToRoadmap} />
          {nextStop ? (
            <View
              style={styles.navCard}
              accessibilityRole="summary"
              accessibilityLabel={`${fmt(s.map.stopOf, { n: nextIndex + 1, total: stops.length })}. ${nextStop.name}. ${navLine}`}>
              <View style={[styles.arrow, { transform: [{ rotate: `${bearing - (location.heading ?? 0)}deg` }] }]}>
                <DuoText style={styles.arrowIcon} color={Brand.onPrimary}>
                  ↑
                </DuoText>
              </View>
              <View style={styles.navTexts}>
                <DuoText variant="label" color={Brand.primary}>
                  {fmt(s.map.stopOf, { n: nextIndex + 1, total: stops.length })}
                </DuoText>
                <DuoText variant="heading" numberOfLines={1}>
                  {nextStop.name}
                </DuoText>
                <DuoText variant="caption" color={t.textMuted}>
                  {navLine}
                </DuoText>
              </View>
            </View>
          ) : (
            <View style={styles.navCard}>
              <DuoText variant="heading">{s.map.routeComplete}</DuoText>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Right: camera buttons */}
      <View style={styles.side} pointerEvents="box-none">
        <RoundButton label="◎" a11y={s.map.centerMe} onPress={() => me && mapRef.current?.flyTo(me, 220)} />
        <RoundButton
          label="📍"
          a11y={s.map.showStop}
          onPress={() => nextStop && mapRef.current?.flyTo(nextStop.coordinates, 260)}
        />
        <RoundButton label="🗺️" a11y={s.map.showRoute} onPress={() => mapRef.current?.overview()} />
        <RoundButton label="⚠️" a11y={s.issues.report} onPress={openReport} />
        <RoundButton
          label={presenting ? '⏹' : '🎬'}
          a11y={presenting ? s.map.stopPresentation : s.map.presentation}
          onPress={togglePresentation}
        />
      </View>

      {/* Bottom: main action */}
      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        {selected ? (
          <View style={styles.issue}>
            <IssueCard
              report={selected}
              onClose={() => {
                setSelectedIssue(null);
                mapRef.current?.focusIssue(null);
              }}
            />
          </View>
        ) : null}
        {nextStop ? (
          <DuoButton
            title={s.map.arrivedButton}
            variant={arrived ? 'primary' : 'secondary'}
            accessibilityHint={nextStop.name}
            onPress={() => openStop(nextStop.id)}
          />
        ) : (
          <DuoButton title={s.map.backToRoadmap} onPress={close} />
        )}
      </SafeAreaView>

      {reportPlace ? <ReportSheet place={reportPlace} onClose={() => setReportPlace(null)} /> : null}
    </View>
  );
}

/** Shortest distance (m) from a point to a polyline's vertices. */
function distanceToPath(p: LatLng, path: LatLng[]): number {
  let best = Infinity;
  for (const q of path) best = Math.min(best, distanceMeters(p, q));
  return best;
}

/** Metres left along `path` from the vertex nearest to `p`. */
function remainingAlong(path: LatLng[], p: LatLng): number {
  let nearest = 0;
  let best = Infinity;
  path.forEach((q, i) => {
    const d = distanceMeters(p, q);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  let total = best;
  for (let i = nearest; i + 1 < path.length; i++) total += distanceMeters(path[i], path[i + 1]);
  return total;
}

function RoundButton({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}>
      {({ pressed }) => (
        <View style={[styles.round, pressed && styles.roundPressed]}>
          <DuoText style={styles.roundIcon}>{label}</DuoText>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.background },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 6 },
  navCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: t.radius.xl,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  navTexts: { flex: 1 },
  side: { position: 'absolute', right: 12, top: '30%', gap: 12 },
  issue: { marginBottom: 12 },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPressed: { backgroundColor: t.cardRaised },
  roundIcon: { fontSize: 22, lineHeight: 28, color: t.text },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: t.background,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
  },
}));
