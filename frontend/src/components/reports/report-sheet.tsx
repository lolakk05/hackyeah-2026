import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import type { IssueGroup, IssueSeverity, IssueType, LatLng } from '@/api/types';
import { DuoButton } from '@/components/duo/duo-button';
import { DuoText } from '@/components/duo/duo-text';
import { celebrateFeedback, errorFeedback, selectionFeedback } from '@/components/duo/haptics';
import { TrophyModel } from '@/components/models/statue-views';
import { Brand } from '@/constants/duo-theme';
import { formatCoins } from '@/game/progression';
import { useI18n } from '@/i18n/language-context';
import type { XpAward } from '@/state/account-context';
import { useJourney } from '@/state/journey-context';
import { useReports } from '@/state/reports-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { ISSUE_GROUPS, ISSUE_PRESETS, ISSUE_SEVERITIES, SEVERITY_COLOR } from './issue-presets';

/** Where the problem is (filled in by the screen that opens the form). */
export interface ReportPlace {
  location: LatLng;
  locationSource: 'gps' | 'landmark' | 'map';
  accuracyMeters?: number;
  landmarkId?: string;
  landmarkName?: string;
  segment?: { fromStopId: string | null; toStopId: string };
  /** Shown at the top, e.g. "Your location". */
  label: string;
}

/**
 * Report a problem: tap a ready-made message, or choose "Something else" to
 * write your own and pick who it affects and how serious it is.
 * Render it only while open (state resets when it closes).
 */
export function ReportSheet({ place, onClose }: { place: ReportPlace; onClose: () => void }) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt, lang } = useI18n();
  const { submit } = useReports();
  const { preferences } = useJourney();

  const [type, setType] = useState<IssueType | null>(null);
  const [comment, setComment] = useState('');
  const [text, setText] = useState('');
  const [affects, setAffects] = useState<IssueGroup[]>(['everyone']);
  const [severity, setSeverity] = useState<IssueSeverity>('hard');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ earned: XpAward; offline: boolean } | null>(null);

  const isOther = type === 'other';
  const textOk = text.trim().length >= 5;
  const valid = !!type && (!isOther || (textOk && affects.length > 0));

  // Close by itself a moment after sending (the parent may re-render often, so use a ref).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => closeRef.current(), 3200);
    return () => clearTimeout(timer);
  }, [done]);

  const choosePreset = (p: (typeof ISSUE_PRESETS)[number]) => {
    selectionFeedback();
    setType(p.type);
    setAffects(p.affects);
    setSeverity(p.severity);
  };
  const chooseOther = () => {
    selectionFeedback();
    setType('other');
    setAffects(['everyone']);
    setSeverity('hard');
  };
  const toggleGroup = (g: IssueGroup) => {
    selectionFeedback();
    setAffects((prev) => {
      if (g === 'everyone') return ['everyone'];
      const rest = prev.filter((x) => x !== 'everyone');
      return rest.includes(g) ? rest.filter((x) => x !== g) : [...rest, g];
    });
  };

  const send = async () => {
    if (!type || !valid) return;
    setSending(true);
    setError(null);
    try {
      const res = await submit({
        type,
        message: isOther ? text.trim() : s.issues.types[type].message,
        comment: isOther ? undefined : comment.trim() || undefined,
        severity,
        affects,
        location: place.location,
        locationSource: place.locationSource,
        accuracyMeters: place.accuracyMeters,
        landmarkId: place.landmarkId,
        landmarkName: place.landmarkName,
        segment: place.segment,
        needs: preferences.needs,
      });
      celebrateFeedback();
      setDone({ earned: res.earned, offline: res.offline });
    } catch (e) {
      errorFeedback();
      setError(fmt(s.issues.error, { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel={s.issues.close} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <DuoText variant="title" accessibilityRole="header" style={styles.flex}>
              ⚠️ {s.issues.report}
            </DuoText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={s.issues.close} hitSlop={12}>
              <DuoText variant="title" color={t.textMuted}>
                ✕
              </DuoText>
            </Pressable>
          </View>

          {done ? (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <TrophyModel backgroundColor={t.card} style={styles.trophy} />
              <DuoText variant="title" style={styles.center}>
                {s.issues.thanks}
              </DuoText>
              {done.earned.xp > 0 ? (
                <DuoText variant="heading" color={Brand.primary}>
                  +{done.earned.xp} {s.common.xp} · +{formatCoins(done.earned.coins, lang)} 🪙
                </DuoText>
              ) : null}
              {done.offline ? (
                <DuoText variant="caption" color={t.textMuted} style={styles.center}>
                  {s.issues.savedOffline}
                </DuoText>
              ) : null}
              <DuoButton title={s.issues.done} size="md" onPress={onClose} style={styles.full} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <DuoText variant="caption" color={t.textMuted}>
                📍 {place.label} · {s.issues.sheetIntro}
              </DuoText>

              <DuoText variant="label" color={t.textMuted}>
                {s.issues.pickOne}
              </DuoText>
              <View style={styles.grid}>
                {ISSUE_PRESETS.map((p) => {
                  const selected = type === p.type;
                  return (
                    <Pressable
                      key={p.type}
                      onPress={() => choosePreset(p)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.preset, selected && styles.selected]}>
                      <DuoText style={styles.presetIcon}>{p.icon}</DuoText>
                      <DuoText variant="caption" style={styles.presetText} numberOfLines={2}>
                        {s.issues.types[p.type].label}
                      </DuoText>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={chooseOther}
                accessibilityRole="radio"
                accessibilityState={{ selected: isOther }}
                style={[styles.other, isOther && styles.selected]}>
                <DuoText style={styles.presetIcon}>✏️</DuoText>
                <View style={styles.flex}>
                  <DuoText variant="heading">{s.issues.other}</DuoText>
                  <DuoText variant="caption" color={t.textMuted}>
                    {s.issues.otherHint}
                  </DuoText>
                </View>
              </Pressable>

              {type && !isOther ? (
                <Field label={s.issues.comment}>
                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder={s.issues.commentPlaceholder}
                    placeholderTextColor={t.lockedText}
                    style={styles.input}
                    maxLength={300}
                  />
                </Field>
              ) : null}

              {isOther ? (
                <>
                  <Field label={s.issues.describe} error={text.length > 0 && !textOk ? s.issues.describeTooShort : null}>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder={s.issues.describePlaceholder}
                      placeholderTextColor={t.lockedText}
                      style={[styles.input, styles.multiline]}
                      multiline
                      maxLength={500}
                      autoFocus
                    />
                  </Field>
                  <Field label={s.issues.affects}>
                    <View style={styles.chips}>
                      {ISSUE_GROUPS.map((g) => (
                        <Chip key={g} label={s.issues.groups[g]} selected={affects.includes(g)} onPress={() => toggleGroup(g)} />
                      ))}
                    </View>
                  </Field>
                  <Field label={s.issues.severity}>
                    <View style={styles.chips}>
                      {ISSUE_SEVERITIES.map((v) => (
                        <Chip
                          key={v}
                          label={s.issues.severities[v]}
                          selected={severity === v}
                          color={SEVERITY_COLOR[v]}
                          onPress={() => {
                            selectionFeedback();
                            setSeverity(v);
                          }}
                        />
                      ))}
                    </View>
                  </Field>
                </>
              ) : null}

              {error ? (
                <DuoText variant="caption" color={Brand.danger}>
                  {error}
                </DuoText>
              ) : null}
              <DuoButton title={s.issues.send} onPress={send} loading={sending} disabled={!valid} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  const t = useDuo();
  return (
    <View style={{ gap: 6 }}>
      <DuoText variant="label" color={t.textMuted}>
        {label}
      </DuoText>
      {children}
      {error ? (
        <DuoText variant="caption" color={Brand.danger}>
          {error}
        </DuoText>
      ) : null}
    </View>
  );
}

function Chip({ label, selected, color, onPress }: { label: string; selected: boolean; color?: string; onPress: () => void }) {
  const t = useDuo();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[styles.chip, selected && { borderColor: color ?? Brand.primary, backgroundColor: t.soft(color ?? Brand.primary, 0.78) }]}>
      <DuoText variant="caption" style={styles.chipText}>
        {label}
      </DuoText>
    </Pressable>
  );
}

const useStyles = themedStyles((t) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,10,18,0.7)' },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: t.card,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 12, gap: 14, maxWidth: 600, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: t.radius.lg,
    backgroundColor: t.cardRaised,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selected: { borderColor: Brand.primary, backgroundColor: t.soft(Brand.primary, 0.82) },
  presetIcon: { fontSize: 24, lineHeight: 30 },
  presetText: { flex: 1, fontWeight: '700' },
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: t.radius.lg,
    backgroundColor: t.cardRaised,
    borderWidth: 1.5,
    borderColor: t.border,
    borderStyle: 'dashed',
  },
  input: {
    minHeight: 52,
    borderRadius: t.radius.lg,
    backgroundColor: t.background,
    borderWidth: 1.5,
    borderColor: t.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: t.text,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: t.cardRaised,
    borderWidth: 1.5,
    borderColor: t.border,
  },
  chipText: { fontWeight: '700' },
  done: { alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 8 },
  trophy: { width: 140, height: 140, borderRadius: 28 },
  center: { textAlign: 'center' },
  full: { alignSelf: 'stretch', marginTop: 6 },
}));
