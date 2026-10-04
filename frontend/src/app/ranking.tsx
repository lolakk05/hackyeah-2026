import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchRanking } from '@/api/account';
import type { Ranking, RankingEntry } from '@/api/types';
import { useLevelTitle } from '@/components/account/level-card';
import { ScreenHeader } from '@/components/account/screen-header';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { PodiumModel } from '@/components/models/statue-views';
import { Brand } from '@/constants/duo-theme';
import { levelInfo } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { themedStyles, useDuo } from '@/state/theme-context';

const MEDALS = ['🥇', '🥈', '🥉'];

/** XP ranking of all players (from the API). */
export default function RankingScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { token, user, refresh } = useAccount();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      await refresh(); // send XP saved offline first, so the ranking is up to date
      setRanking(await fetchRanking(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  const me = ranking?.me;
  const meVisible = !!me && !!ranking?.entries.some((e) => e.userId === me.userId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={s.ranking.title} onBack={back} />
      {!ranking && !error ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error && !ranking ? (
        <View style={styles.center}>
          <DuoText variant="heading">😕 {s.ranking.error}</DuoText>
          <DuoText variant="caption" color={t.textMuted} style={styles.centerText}>
            {error}
          </DuoText>
          <DuoButton title={s.common.tryAgain} variant="secondary" size="md" onPress={load} />
        </View>
      ) : (
        <FlatList
          data={ranking?.entries ?? []}
          keyExtractor={(e) => e.userId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <DuoText variant="body" color={t.textMuted} style={styles.subtitle}>
                {s.ranking.subtitle}
              </DuoText>
              {ranking && ranking.entries.length > 0 ? <Podium top={ranking.entries.slice(0, 3)} meId={user?.id} /> : null}
            </View>
          }
          ListEmptyComponent={
            <DuoText variant="body" color={t.textMuted} style={styles.centerText}>
              {s.ranking.empty}
            </DuoText>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={Brand.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }) => <Row entry={item} isMe={item.userId === user?.id} />}
        />
      )}
      {me && !meVisible ? (
        <View style={styles.footer}>
          <DuoText variant="caption" color={t.textMuted} style={styles.centerText}>
            {fmt(s.ranking.yourPlace, { rank: me.rank })}
          </DuoText>
          <Row entry={me} isMe />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** 3D podium (2nd · 1st · 3rd) with statues, names and XP under each step. */
function Podium({ top, meId }: { top: RankingEntry[]; meId?: string }) {
  const t = useDuo();
  const styles = useStyles();
  const { s } = useI18n();
  const order = [top[1], top[0], top[2]];
  return (
    <View style={styles.podium}>
      <PodiumModel players={top.length} backgroundColor={t.surface} style={styles.podiumModel} />
      <View style={styles.podiumNames}>
        {order.map((e, i) => (
          <View key={e?.userId ?? i} style={styles.podiumName}>
            {e ? (
              <>
                <DuoText variant="caption" style={styles.bold} numberOfLines={1} color={e.userId === meId ? Brand.primary : t.text}>
                  {MEDALS[e.rank - 1]} {e.userId === meId ? s.ranking.you : e.username}
                </DuoText>
                <DuoText variant="caption" color={t.textMuted}>
                  {e.xp} {s.common.xp}
                </DuoText>
              </>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({ entry, isMe }: { entry: RankingEntry; isMe: boolean }) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const title = useLevelTitle();
  const level = levelInfo(entry.xp).level;
  return (
    <View
      style={[styles.row, isMe && styles.rowMe]}
      accessibilityLabel={`#${entry.rank}, ${entry.username}${isMe ? ` (${s.ranking.you})` : ''}, ${fmt(s.profile.level, { n: level })}, ${entry.xp} ${s.common.xp}`}>
      <View style={styles.rank}>
        {entry.rank <= 3 ? (
          <DuoText style={styles.medal}>{MEDALS[entry.rank - 1]}</DuoText>
        ) : (
          <DuoText variant="heading" color={t.textMuted}>
            {entry.rank}
          </DuoText>
        )}
      </View>
      <View style={[styles.avatar, isMe && styles.avatarMe]}>
        <DuoText variant="heading" color={isMe ? Brand.onPrimary : t.text}>
          {entry.username.slice(0, 1).toUpperCase()}
        </DuoText>
      </View>
      <View style={styles.flex}>
        <DuoText variant="heading" numberOfLines={1}>
          {entry.username}
          {isMe ? ` · ${s.ranking.you}` : ''}
        </DuoText>
        <DuoText variant="caption" color={t.textMuted} numberOfLines={1}>
          {fmt(s.profile.level, { n: level })} · {title(level)}
        </DuoText>
      </View>
      <DuoText variant="heading" color={Brand.primary}>
        {entry.xp} {s.common.xp}
      </DuoText>
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  header: { gap: 12, marginBottom: 8 },
  podium: { borderRadius: t.radius.xl, backgroundColor: t.surface, overflow: 'hidden', paddingBottom: 12 },
  podiumModel: { height: 200 },
  podiumNames: { flexDirection: 'row', paddingHorizontal: 8 },
  podiumName: { flex: 1, alignItems: 'center' },
  bold: { fontWeight: '700' },
  list: { padding: 16, gap: 8, maxWidth: 600, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: t.radius.lg,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowMe: { borderColor: Brand.primary, backgroundColor: t.cardRaised },
  rank: { width: 34, alignItems: 'center' },
  medal: { fontSize: 26, lineHeight: 32 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.locked,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: Brand.primary },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 6, borderTopWidth: 1, borderTopColor: t.border },
}));
