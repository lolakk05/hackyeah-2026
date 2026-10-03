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
import { Brand, shade } from '@/constants/duo-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { bearingDegrees, compassWord, distanceMeters, formatDistance } from '@/map/geo';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Within this distance you can tap "I'm here". */
const ARRIVED_METERS = 40;

/** 3D map with navigation from your position to the next stop of the route. */
export default function MapScreen() {
  const t = useDuo();
  const styles = useStyles();
  const j = useJourney();
  const mapRef = useRef<CityMapHandle>(null);

  const stops = j.roadmap;
  const nextStop = stops.find((s) => s.id === j.currentId) ?? null;
  const nextIndex = nextStop ? stops.indexOf(nextStop) : -1;
  // Demo fallback position: the previous stop (or a spot on the Main Square for the first leg).
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
    if (route && routeFrom.current && distanceMeters(routeFrom.current, me) < 25 && route.path.at(-1) === nextStop.coordinates)
      return;
    routeFrom.current = me;
    let cancelled = false;
    fetchWalkingRoute(me, nextStop.coordinates, j.preferences.needs).then((r) => {
      if (!cancelled) setRoute({ ...r, path: [...r.path.slice(0, -1), nextStop.coordinates] });
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
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextStop?.id, !!me]);

  const mapStops = useMemo(
    () =>
      stops.map((s) => ({
        landmark: s,
        state: (j.completedIds.includes(s.id) ? 'done' : s.id === j.currentId ? 'next' : 'later') as StopState,
      })),
    [stops, j.completedIds, j.currentId],
  );

  const straight = me && nextStop ? distanceMeters(me, nextStop.coordinates) : null;
  const remaining = route?.distanceMeters ?? straight ?? 0;
  const arrived = straight !== null && straight < ARRIVED_METERS;
  const bearing = me && nextStop ? bearingDegrees(me, nextStop.coordinates) : 0;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/roadmap'));
  const openStop = (id: string) => router.push({ pathname: '/place/[id]', params: { id } });

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
          <RoundButton label="✕" onPress={close} a11y="Back to roadmap" />
          {nextStop ? (
            <View
              style={[styles.navCard, { backgroundColor: nextStop.color, borderBottomColor: shade(nextStop.color, 0.22) }]}
              accessibilityRole="summary"
              accessibilityLabel={`Next stop ${nextStop.name}, ${formatDistance(remaining)}, about ${route?.durationMinutes ?? '?'} minutes, head ${compassWord(bearing)}`}>
              <View style={[styles.arrow, { transform: [{ rotate: `${bearing - (location.heading ?? 0)}deg` }] }]}>
                <DuoText style={styles.arrowIcon} color={Brand.onColor}>
                  ⬆
                </DuoText>
              </View>
              <View style={styles.navTexts}>
                <DuoText variant="label" color="rgba(255,255,255,0.9)">
                  STOP {nextIndex + 1} OF {stops.length}
                </DuoText>
                <DuoText variant="heading" color={Brand.onColor} numberOfLines={1}>
                  {nextStop.name}
                </DuoText>
                <DuoText variant="caption" color={Brand.onColor}>
                  {arrived
                    ? 'You have arrived! 🎉'
                    : `${formatDistance(remaining)} · ${route?.durationMinutes ?? '…'} min · head ${compassWord(bearing)}`}
                </DuoText>
              </View>
            </View>
          ) : (
            <View style={[styles.navCard, { backgroundColor: Brand.yellow, borderBottomColor: Brand.yellowDark }]}>
              <DuoText variant="heading" color={Brand.onColor}>
                🏆 Route complete!
              </DuoText>
            </View>
          )}
        </View>
        {location.source === 'simulated' ? (
          <View style={styles.demoBadge}>
            <DuoText variant="caption" color={t.text}>
              {location.permissionDenied ? '📍 Location is off' : '📍 You’re not in Kraków'}: demo position at the
              previous stop
            </DuoText>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Right: camera buttons */}
      <View style={styles.side} pointerEvents="box-none">
        <RoundButton label="🎯" a11y="Center on me" onPress={() => me && mapRef.current?.flyTo(me, 220)} />
        <RoundButton
          label="📍"
          a11y="Show next stop"
          onPress={() => nextStop && mapRef.current?.flyTo(nextStop.coordinates, 260)}
        />
        <RoundButton label="🗺️" a11y="Show whole route" onPress={() => mapRef.current?.overview()} />
      </View>

      {/* Bottom: main action */}
      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        {nextStop ? (
          <DuoButton
            title={arrived ? `I'm here! Open ${nextStop.name}` : `I'm at ${nextStop.name}`}
            subtitle={arrived ? 'Read about it and collect your XP' : 'Tap when you get there'}
            variant={arrived ? 'green' : 'blue'}
            onPress={() => openStop(nextStop.id)}
          />
        ) : (
          <DuoButton title="Back to roadmap" variant="orange" onPress={() => router.replace('/roadmap')} />
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
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 6 },
  navCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: t.radius.lg,
    borderBottomWidth: 5,
  },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: { fontSize: 26, lineHeight: 32 },
  navTexts: { flex: 1 },
  demoBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: t.card,
    borderWidth: 2,
    borderColor: t.border,
  },
  side: { position: 'absolute', right: 12, top: '38%', gap: 12 },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.card,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPressed: { borderBottomWidth: 2, marginTop: 3 },
  roundIcon: { fontSize: 24, lineHeight: 30 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: t.card,
    borderTopWidth: 2,
    borderTopColor: t.border,
  },
}));
