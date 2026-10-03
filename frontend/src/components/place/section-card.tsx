import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { themedStyles } from '@/state/theme-context';

/** White rounded card with a heading, used for every section of the place page. */
export function SectionCard({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <DuoText variant="heading" accessibilityRole="header" style={styles.title}>
        {icon}  {title}
      </DuoText>
      {children}
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  card: {
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: t.border,
    borderRadius: t.radius.lg,
    padding: 18,
    gap: 12,
    backgroundColor: t.card,
  },
  title: { marginBottom: 2 },
}));
