import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Landmark } from '@/api/types';
import { ScreenHeader } from '@/components/account/screen-header';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { selectionFeedback, tapFeedback } from '@/components/duo/haptics';
import { LandmarkModel } from '@/components/models/landmark-model';
import { Brand, formatDuration } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

type Filter = 'all' | 'visited' | 'notVisited';

/** Every place you can visit, with what you've already seen. Tap one to open its page. */
export default function PlacesScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { stats } = useAccount();
  const { allPlaces, placesState, loadAllPlaces } = useJourney();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (placesState === 'idle') loadAllPlaces();
  }, [placesState, loadAllPlaces]);

  const visited = (id: string) => stats.places.includes(id);
  const visitedCount = allPlaces.filter((p) => visited(p.id)).length;
  const list = allPlaces.filter((p) =>
    filter === 'all' ? true : filter === 'visited' ? visited(p.id) : !visited(p.id),
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  const open = (lm: Landmark) => router.push({ pathname: '/place/[id]', params: { id: lm.id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={s.places.title} onBack={back} />

      {placesState === 'error' && allPlaces.length === 0 ? (
        <View style={styles.center}>
          <DuoText variant="heading">😕 {s.places.error}</DuoText>
          <DuoButton title={s.common.tryAgain} variant="secondary" size="md" onPress={loadAllPlaces} />
        </View>
      ) : placesState !== 'ready' && allPlaces.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.summary}>
                <DuoText variant="heading">{fmt(s.places.visitedCount, { n: visitedCount, total: allPlaces.length })}</DuoText>
                <View style={styles.track}>
                  <View
                    style={[styles.fill, { width: `${allPlaces.length ? (visitedCount / allPlaces.length) * 100 : 0}%` }]}
                  />
                </View>
              </View>
              <View style={styles.tabs}>
                {(['all', 'visited', 'notVisited'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => {
                      selectionFeedback();
                      setFilter(f);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filter === f }}
                    style={[styles.tab, filter === f && styles.tabOn]}>
                    <DuoText variant="caption" style={styles.bold} color={filter === f ? Brand.onPrimary : t.text}>
                      {s.places[f]}
                    </DuoText>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <DuoText variant="body" color={t.textMuted} style={styles.centerText}>
              {s.places.empty}
            </DuoText>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={Brand.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await loadAllPlaces();
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }) => {
            const done = visited(item.id);
            return (
              <Pressable
                onPress={() => {
                  tapFeedback();
                  open(item);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}. ${item.tagline}${done ? `. ${s.places.visitedBadge}` : ''}`}>
                {({ pressed }) => (
                  <View style={[styles.card, done && styles.cardDone, pressed && styles.pressed]}>
                    <View style={[styles.tile, { backgroundColor: item.color }]}>
                      <LandmarkModel kind={item.model} backgroundColor={item.color} animate={false} style={styles.model} />
                    </View>
                    <View style={styles.texts}>
                      <DuoText variant="heading" numberOfLines={2}>
                        {item.name}
                      </DuoText>
                      <DuoText variant="caption" color={t.textMuted} numberOfLines={1}>
                        {item.tagline}
                      </DuoText>
                      <View style={styles.meta}>
                        <DuoText variant="caption" color={t.textMuted}>
                          {fmt(s.places.visit, { time: formatDuration(item.visitMinutes) })}
                        </DuoText>
                        {item.accessibility.wheelchair === 'full' ? (
                          <DuoText variant="caption" color={t.textMuted}>
                            ♿
                          </DuoText>
                        ) : null}
                        {done ? (
                          <DuoText variant="caption" color={Brand.success} style={styles.bold}>
                            {s.places.visitedBadge}
                          </DuoText>
                        ) : null}
                      </View>
                    </View>
                    <DuoText style={styles.chevron} color={t.lockedText}>
                      ›
                    </DuoText>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const TILE = 76;

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { textAlign: 'center', marginTop: 24 },
  list: { padding: 16, gap: 10, maxWidth: 600, width: '100%', alignSelf: 'center' },
  header: { gap: 12, marginBottom: 4 },
  summary: { padding: 16, gap: 10, borderRadius: t.radius.xl, backgroundColor: t.surface },
  track: { height: 10, borderRadius: 5, backgroundColor: t.locked, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: Brand.success },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: t.card },
  tabOn: { backgroundColor: Brand.primary },
  bold: { fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: t.radius.xl,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardDone: { borderColor: t.soft(Brand.success, 0.5) },
  pressed: { opacity: 0.85 },
  tile: { width: TILE, height: TILE, borderRadius: 20, overflow: 'hidden' },
  model: { width: TILE, height: TILE },
  texts: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 2 },
  chevron: { fontSize: 30, lineHeight: 34, paddingHorizontal: 4 },
}));
