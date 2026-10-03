import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchWalkingRoute } from '@/api/client';
import type { WalkingRoute } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { CityMap3D, type CityMapHandle, type StopState } from '@/components/map/city-map-3d';
import { Brand } from '@/constants/duo-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useI18n } from '@/i18n/language-context';
import { bearingDegrees, distanceMeters, formatDistance } from '@/map/geo';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Within this distance you can tap "I'm here". */
const ARRIVED_METERS = 40;

/** 3D map with navigation from your position to the next stop of the route. */
export default function MapScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const j = useJourney();
  const mapRef = useRef<CityMapHandle>(null);

  const stops = j.roadmap;
  const nextStop = stops.find((st) => st.id === j.currentId) ?? null;
  const nextIndex = nextStop ? stops.indexOf(nextStop) : -1;
  // Fallback position when GPS isn't available or you're not in Kraków:
  // the previous stop (or a spot on the Main Square for the first leg).
  const previous = nextIndex > 0 ? stops[nextIndex - 1].coordinates : { latitude: 50.0614, longitude: 19.9366 };
  const location = useUserLocation(previous);
  const me = location.position;

  // ── Walking route from me to the next stop ──
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const routeFrom = useRef<typeof me>(null);
  useEffect(() => {
    if (!me || !nextStop) {
      setRoute(null);
      return;
    }
    // Only re-route when we moved more than 25 m (or the stop changed).
    if (
      route &&
      routeFrom.current &&
      distanceMeters(routeFrom.current, me) < 25 &&
      route.path.at(-1) === nextStop.coordinates
    )
      return;
    routeFrom.current = me;
    let cancelled = false;
    fetchWalkingRoute(me, nextStop.coordinates, j.preferences.needs).then((r) => {
      if (cancelled) return;
      const path = [...r.path.slice(0, -1), nextStop.coordinates];
      setRoute({ ...r, path });
      // Remember the walked section, for the accessibility question on arrival.
      j.setLegPath(nextStop.id, path);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.latitude, me?.longitude, nextStop?.id]);

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
  const remaining = route?.distanceMeters ?? straight ?? 0;
  const arrived = straight !== null && straight < ARRIVED_METERS;
  const bearing = me && nextStop ? bearingDegrees(me, nextStop.coordinates) : 0;
  const direction = s.map.directions[Math.round(bearing / 45) % 8];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/roadmap'));
  const openStop = (id: string) => router.push({ pathname: '/place/[id]', params: { id } });
  const navLine = arrived
    ? s.map.arrived
    : fmt(s.map.nav, { dist: formatDistance(remaining), min: route?.durationMinutes ?? '…', dir: direction });

  return (
    <View style={styles.root}>
      <CityMap3D
        ref={mapRef}
        landmarks={j.landmarks}
        stops={mapStops}
        user={me}
        route={route?.path ?? null}
        onPressLandmark={openStop}
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
      </View>

      {/* Bottom: main action */}
      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        {nextStop ? (
          <DuoButton
            title={fmt(arrived ? s.map.imHereOpen : s.map.imAt, { name: nextStop.name })}
            subtitle={arrived ? s.map.imHereOpenSub : s.map.imAtSub}
            variant={arrived ? 'primary' : 'secondary'}
            onPress={() => openStop(nextStop.id)}
          />
        ) : (
          <DuoButton title={s.map.backToRoadmap} onPress={() => router.replace('/roadmap')} />
        )}
      </SafeAreaView>
    </View>
  );
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
  side: { position: 'absolute', right: 12, top: '36%', gap: 12 },
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
