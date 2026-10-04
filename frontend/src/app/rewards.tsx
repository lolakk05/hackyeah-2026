import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountError, fetchRedemptions, fetchRewards, redeemReward } from '@/api/account';
import { USE_MOCK_ACCOUNTS } from '@/api/config';
import type { Redemption, Reward } from '@/api/types';
import { ScreenHeader } from '@/components/account/screen-header';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { celebrateFeedback, errorFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { formatCoins } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import { useAccount } from '@/state/account-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Spend coins on Kraków public transport discount codes. */
export default function RewardsScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const { user, token, setCoins, refresh } = useAccount();
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [codes, setCodes] = useState<Redemption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newCodeId, setNewCodeId] = useState<string | null>(null);
  const coins = user?.coins ?? 0;

  const load = useCallback(async () => {
    setError(null);
    try {
      await refresh();
      const [list, mine] = await Promise.all([fetchRewards(), token ? fetchRedemptions(token) : []]);
      setRewards(list);
      setCodes(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async (reward: Reward) => {
    if (!token) return;
    setBusyId(reward.id);
    try {
      const res = await redeemReward(token, reward.id);
      setCoins(res.coins);
      setCodes((prev) => [res.redemption, ...prev]);
      setNewCodeId(res.redemption.id);
      celebrateFeedback();
    } catch (e) {
      const msg =
        e instanceof AccountError && e.code === 'not_enough_coins'
          ? s.rewards.notEnough
          : fmt(s.rewards.redeemError, { msg: e instanceof Error ? e.message : String(e) });
      errorFeedback();
      Alert.alert(s.rewards.title, msg);
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (reward: Reward) => {
    const title = fmt(s.rewards.confirmTitle, { cost: formatCoins(reward.cost, lang) });
    if (Platform.OS === 'web') {
      redeem(reward);
      return;
    }
    Alert.alert(title, reward.title, [
      { text: s.rewards.cancel, style: 'cancel' },
      { text: s.rewards.confirm, onPress: () => redeem(reward) },
    ]);
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  const newCode = codes.find((c) => c.id === newCodeId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={s.rewards.title} onBack={back} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balance} accessibilityLabel={`${s.rewards.balance}: ${formatCoins(coins, lang)}`}>
          <DuoText style={styles.balanceIcon}>🪙</DuoText>
          <View>
            <DuoText variant="label" color={Brand.onPrimary}>
              {s.rewards.balance}
            </DuoText>
            <DuoText variant="hero" color={Brand.onPrimary}>
              {formatCoins(coins, lang)}
            </DuoText>
          </View>
        </View>
        <DuoText variant="body" color={t.textMuted} style={styles.centerText}>
          {s.rewards.subtitle}
        </DuoText>

        {newCode ? <CodeCard code={newCode} highlight label={s.rewards.newCode} formatDate={formatDate} /> : null}

        {!rewards && !error ? (
          <ActivityIndicator size="large" color={Brand.primary} style={styles.loader} />
        ) : error && !rewards ? (
          <View style={styles.centerBox}>
            <DuoText variant="heading">😕 {s.rewards.error}</DuoText>
            <DuoText variant="caption" color={t.textMuted} style={styles.centerText}>
              {error}
            </DuoText>
            <DuoButton title={s.common.tryAgain} variant="secondary" size="md" onPress={load} />
          </View>
        ) : (
          rewards?.map((r) => {
            const affordable = coins >= r.cost;
            return (
              <View key={r.id} style={styles.offer}>
                <View style={styles.offerTop}>
                  <View style={styles.offerIcon}>
                    <DuoText style={styles.offerEmoji}>{r.icon ?? '🎟️'}</DuoText>
                  </View>
                  <View style={styles.flex}>
                    <DuoText variant="heading">{r.title}</DuoText>
                    <DuoText variant="caption" color={t.textMuted}>
                      {r.description}
                    </DuoText>
                  </View>
                </View>
                <DuoButton
                  title={`${s.rewards.redeem} · ${formatCoins(r.cost, lang)} 🪙`}
                  subtitle={affordable ? undefined : fmt(s.rewards.missing, { n: formatCoins(Math.round((r.cost - coins) * 10) / 10, lang) })}
                  size="md"
                  disabled={!affordable || (busyId !== null && busyId !== r.id)}
                  loading={busyId === r.id}
                  onPress={() => confirm(r)}
                />
              </View>
            );
          })
        )}

        <DuoText variant="heading" style={styles.sectionTitle}>
          {s.rewards.myCodes}
        </DuoText>
        {codes.length === 0 ? (
          <DuoText variant="body" color={t.textMuted}>
            {s.rewards.noCodes}
          </DuoText>
        ) : (
          codes
            .filter((c) => c.id !== newCodeId)
            .map((c) => <CodeCard key={c.id} code={c} formatDate={formatDate} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CodeCard({
  code,
  highlight,
  label,
  formatDate,
}: {
  code: Redemption;
  highlight?: boolean;
  label?: string;
  formatDate: (iso?: string) => string;
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  return (
    <View style={[styles.code, highlight && styles.codeNew]}>
      {label ? (
        <DuoText variant="label" color={Brand.primary}>
          🎉 {label}
        </DuoText>
      ) : null}
      <DuoText variant="body">{code.title}</DuoText>
      <View style={styles.codeBox}>
        <DuoText selectable style={styles.codeText} accessibilityLabel={code.code.split('').join(' ')}>
          {code.code}
        </DuoText>
      </View>
      <DuoText variant="caption" color={t.textMuted}>
        {s.rewards.howToUse}
        {code.expiresAt ? ` ${fmt(s.rewards.validUntil, { date: formatDate(code.expiresAt) })}.` : ''}
      </DuoText>
      {USE_MOCK_ACCOUNTS ? (
        <DuoText variant="caption" color={t.lockedText}>
          {s.rewards.demo}
        </DuoText>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  content: { padding: 20, gap: 14, maxWidth: 600, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  centerBox: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  loader: { marginVertical: 32 },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 18,
    borderRadius: t.radius.xl,
    backgroundColor: Brand.primary,
  },
  balanceIcon: { fontSize: 48, lineHeight: 56 },
  offer: { padding: 16, gap: 14, borderRadius: t.radius.xl, backgroundColor: t.card },
  offerTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  offerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: t.soft(Brand.sky, 0.7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerEmoji: { fontSize: 30, lineHeight: 36 },
  sectionTitle: { marginTop: 12 },
  code: { padding: 16, gap: 8, borderRadius: t.radius.xl, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.border },
  codeNew: { borderColor: Brand.primary, backgroundColor: t.cardRaised },
  codeBox: {
    paddingVertical: 14,
    borderRadius: t.radius.md,
    backgroundColor: t.background,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.primary,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 2,
    color: t.text,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
}));
