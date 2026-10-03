import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/account/screen-header';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { IssueCard } from '@/components/reports/issue-card';
import { ReportSheet, type ReportPlace } from '@/components/reports/report-sheet';
import { Brand } from '@/constants/duo-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useI18n } from '@/i18n/language-context';
import { MAP_ORIGIN } from '@/map/geo';
import { useAccount } from '@/state/account-context';
import { useReports } from '@/state/reports-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** All problem reports (or only mine), and a button to report a new one. */
export default function ReportsScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s } = useI18n();
  const { user } = useAccount();
  const reports = useReports();
  const location = useUserLocation(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [place, setPlace] = useState<ReportPlace | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    reports.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = filter === 'mine' ? reports.issues.filter((i) => i.userId === user?.id) : reports.issues;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  const openForm = () => {
    const gps = location.source === 'gps' && location.position;
    setPlace({
      location: gps ? location.position! : MAP_ORIGIN,
      locationSource: gps ? 'gps' : 'map',
      label: gps ? s.issues.myLocation : s.issues.mapCenter,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={s.issues.title} onBack={back} />
      <View style={styles.tabs}>
        {(['all', 'mine'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              tapFeedback();
              setFilter(f);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            style={[styles.tab, filter === f && styles.tabOn]}>
            <DuoText variant="caption" style={styles.bold} color={filter === f ? Brand.onPrimary : t.text}>
              {f === 'all' ? s.issues.all : s.issues.mine}
            </DuoText>
          </Pressable>
        ))}
      </View>

      {reports.loading && reports.issues.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <IssueCard report={item} />}
          ListHeaderComponent={
            reports.error ? (
              <DuoText variant="caption" color={Brand.danger} style={styles.centerText}>
                {s.issues.loadError}: {reports.error}
              </DuoText>
            ) : null
          }
          ListEmptyComponent={
            <DuoText variant="body" color={t.textMuted} style={styles.centerText}>
              {filter === 'mine' ? s.issues.emptyMine : s.issues.empty}
            </DuoText>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={Brand.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await reports.refresh();
                setRefreshing(false);
              }}
            />
          }
        />
      )}

      <View style={styles.footer}>
        <DuoButton title={`⚠️ ${s.issues.report}`} onPress={openForm} />
      </View>

      {place ? <ReportSheet place={place} onClose={() => setPlace(null)} /> : null}
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8, alignSelf: 'center' },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: t.card },
  tabOn: { backgroundColor: Brand.primary },
  bold: { fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center', marginVertical: 12 },
  list: { padding: 16, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
}));
