import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand, shade } from '@/constants/duo-theme';
import { themedStyles } from '@/state/theme-context';

/** The coloured "Section" banner at the top of the roadmap. */
export function UnitBanner({
  overline,
  title,
  color = Brand.green,
  actionLabel,
  onAction,
}: {
  overline: string;
  title: string;
  color?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.banner, { backgroundColor: color, borderBottomColor: shade(color, 0.2) }]}>
      <View style={styles.texts}>
        <DuoText variant="label" color="rgba(255,255,255,0.85)">
          {overline.toUpperCase()}
        </DuoText>
        <DuoText variant="heading" color={Brand.onColor}>
          {title}
        </DuoText>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            tapFeedback();
            onAction();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}>
          {({ pressed }) => (
            <View
              style={[
                styles.action,
                { borderColor: shade(color, 0.2), borderBottomWidth: pressed ? 2 : 4, marginTop: pressed ? 2 : 0 },
              ]}>
              <DuoText variant="label" color={Brand.onColor}>
                {actionLabel}
              </DuoText>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.radius.lg,
    borderBottomWidth: 5,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  texts: { flex: 1 },
  action: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
}));
