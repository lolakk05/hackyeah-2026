import { Pressable, View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Header card at the top of the roadmap (trip summary + optional action). */
export function UnitBanner({
  overline,
  title,
  actionLabel,
  onAction,
}: {
  overline: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useDuo();
  const styles = useStyles();
  return (
    <View style={styles.banner}>
      <View style={styles.texts}>
        <DuoText variant="label" color={Brand.primary}>
          {overline}
        </DuoText>
        <DuoText variant="title">{title}</DuoText>
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
            <View style={[styles.action, pressed && { backgroundColor: t.border }]}>
              <DuoText variant="caption" style={styles.actionText}>
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
    alignItems: 'flex-end',
    gap: 12,
    paddingVertical: 8,
  },
  texts: { flex: 1, gap: 4 },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: t.cardRaised,
  },
  actionText: { fontWeight: '700' },
}));
