import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontWeights, theme } from '@/constants/duo-theme';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const variants = StyleSheet.create({
  hero: { fontSize: 34, lineHeight: 40, fontWeight: FontWeights.heavy, letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: FontWeights.heavy, letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: FontWeights.bold },
  body: { fontSize: 17, lineHeight: 25, fontWeight: FontWeights.regular },
  label: { fontSize: 12, lineHeight: 16, fontWeight: FontWeights.bold, letterSpacing: 1.2, textTransform: 'uppercase' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: FontWeights.regular },
});

/** Text in the app's type scale. Defaults to the main text colour. */
export function DuoText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return <Text style={[variants[variant], { color: color ?? theme.text }, style]} {...rest} />;
}
