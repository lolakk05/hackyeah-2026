import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelCard } from '@/components/account/level-card';
import { ScreenHeader } from '@/components/account/screen-header';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { Brand } from '@/constants/duo-theme';
import { COINS_PER_XP, formatCoins, XP_RULES } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { useJourney } from '@/state/journey-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** The user's level, XP, coins, how to earn XP, and sign out. */
export default function ProfileScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const account = useAccount();
  const { resetTrip } = useJourney();
  const { user } = account;

  // Fresh totals from the backend (also sends XP saved while offline).
  useEffect(() => {
    account.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  const logout = () => {
    resetTrip();
    account.logout();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
  };

  const rules = [
    { icon: '♿', label: s.profile.howReport, value: fmt(s.profile.howReportValue, { n: XP_RULES.report }), highlight: true },
    {
      icon: '📍',
      label: s.profile.howVisit,
      value: fmt(s.profile.howVisitValue, { base: XP_RULES.visitBase, per: XP_RULES.visitPer100m }),
    },
    {
      icon: '🏁',
      label: s.profile.howRoute,
      value: fmt(s.profile.howRouteValue, { base: XP_RULES.routeBase, per: XP_RULES.routePerKm }),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={s.profile.title} onBack={back} />
      <ScrollView contentContainerStyle={styles.content}>
        {user ? (
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <DuoText variant="title" color={Brand.onPrimary}>
                {user.username.slice(0, 1).toUpperCase()}
              </DuoText>
            </View>
            <View style={styles.flex}>
              <DuoText variant="title" numberOfLines={1}>
                {user.username}
              </DuoText>
              <DuoText variant="caption" color={t.textMuted} numberOfLines={1}>
                {user.email}
              </DuoText>
            </View>
          </View>
        ) : null}

        <LevelCard />
        <DuoText variant="caption" color={t.textMuted} style={styles.center}>
          {fmt(s.profile.xpTotal, { n: user?.xp ?? 0 })}
        </DuoText>

        <View style={styles.buttonRow}>
          <DuoButton
            title={`🏆 ${s.profile.ranking}`}
            variant="secondary"
            size="md"
            style={styles.flex}
            onPress={() => router.push('/ranking')}
          />
          <DuoButton
            title={`🎟️ ${s.profile.rewards}`}
            variant="secondary"
            size="md"
            style={styles.flex}
            onPress={() => router.push('/rewards')}
          />
        </View>

        <View style={styles.card}>
          <DuoText variant="heading">{s.profile.howTitle}</DuoText>
          {rules.map((r) => (
            <View key={r.label} style={styles.ruleRow}>
              <DuoText style={styles.ruleIcon}>{r.icon}</DuoText>
              <View style={styles.flex}>
                <DuoText variant="body">{r.label}</DuoText>
                <DuoText variant="caption" color={r.highlight ? Brand.primary : t.textMuted}>
                  {r.value}
                </DuoText>
              </View>
            </View>
          ))}
          <DuoText variant="caption" color={t.textMuted}>
            {fmt(s.profile.howCoins, { n: formatCoins(COINS_PER_XP, lang) })}
          </DuoText>
        </View>

        {account.pendingCount > 0 ? (
          <DuoText variant="caption" color={t.textMuted} style={styles.center}>
            ⏳ {fmt(s.profile.pending, { n: account.pendingCount })}
          </DuoText>
        ) : null}

        <DuoButton title={s.profile.logout} variant="secondary" size="md" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  content: { padding: 20, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  card: { padding: 16, gap: 14, borderRadius: t.radius.xl, backgroundColor: t.surface },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleIcon: { fontSize: 24, lineHeight: 30, width: 32, textAlign: 'center' },
}));
