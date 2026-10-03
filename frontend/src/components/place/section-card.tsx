import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { themedStyles } from '@/state/theme-context';

/** Rounded card with a heading, used for every section of the place page. */
export function SectionCard({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <DuoText variant="heading" accessibilityRole="header">
        {icon}  {title}
      </DuoText>
      {children}
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  card: {
    borderRadius: t.radius.xl,
    padding: 20,
    gap: 12,
    backgroundColor: t.card,
  },
}));
