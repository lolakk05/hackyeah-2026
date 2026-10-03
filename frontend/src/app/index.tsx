import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import type { Lang } from '@/i18n/strings';
import { themedStyles, useDuo } from '@/state/theme-context';

const LANGUAGES: { lang: Lang; flag: string; name: string; hint: string }[] = [
  { lang: 'pl', flag: '🇵🇱', name: 'Polski', hint: 'Kontynuuj po polsku' },
  { lang: 'en', flag: '🇬🇧', name: 'English', hint: 'Continue in English' },
];

/** First screen: choose the app language. */
export default function LanguageScreen() {
  const t = useDuo();
  const styles = useStyles();
  const { lang, setLang } = useI18n();

  const choose = (l: Lang) => {
    tapFeedback(true);
    setLang(l);
    router.push('/welcome');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <DuoText style={styles.globe}>🌍</DuoText>
        <DuoText variant="title" style={styles.center} accessibilityRole="header">
          Wybierz język{'\n'}Choose your language
        </DuoText>

        <View style={styles.list}>
          {LANGUAGES.map((l) => (
            <Pressable
              key={l.lang}
              onPress={() => choose(l.lang)}
              accessibilityRole="button"
              accessibilityLabel={l.name}
              accessibilityHint={l.hint}
              accessibilityState={{ selected: lang === l.lang }}>
              {({ pressed }) => (
                <View style={[styles.option, lang === l.lang && styles.optionSelected, pressed && styles.pressed]}>
                  <DuoText style={styles.flag}>{l.flag}</DuoText>
                  <View style={styles.texts}>
                    <DuoText variant="title">{l.name}</DuoText>
                    <DuoText variant="caption" color={t.textMuted}>
                      {l.hint}
                    </DuoText>
                  </View>
                  <DuoText variant="title" color={Brand.primary}>
                    →
                  </DuoText>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.background },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  globe: { fontSize: 64, lineHeight: 76, textAlign: 'center' },
  center: { textAlign: 'center' },
  list: { gap: 14, marginTop: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    minHeight: 92,
    borderRadius: t.radius.xl,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionSelected: { borderColor: Brand.primary },
  pressed: { backgroundColor: t.cardRaised },
  flag: { fontSize: 40, lineHeight: 48 },
  texts: { flex: 1 },
}));
