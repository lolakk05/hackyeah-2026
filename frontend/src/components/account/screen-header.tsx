import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Back arrow + title row used by the profile, ranking and rewards screens. */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const t = useDuo();
  const styles = useStyles();
  const { s } = useI18n();
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={s.common.back} hitSlop={12}>
        <DuoText variant="title" color={t.textMuted}>
          ←
        </DuoText>
      </Pressable>
      <DuoText variant="heading" accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {title}
      </DuoText>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const useStyles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  title: { flex: 1, textAlign: 'center' },
  right: { minWidth: 26, alignItems: 'flex-end' },
}));
