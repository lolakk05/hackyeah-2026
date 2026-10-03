import { StyleSheet, Text, type TextProps } from 'react-native';

import { DuoFonts } from '@/constants/duo-theme';
import { useDuo } from '@/state/theme-context';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const variants = StyleSheet.create({
  hero: { fontFamily: DuoFonts.black, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: DuoFonts.black, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: DuoFonts.extraBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: DuoFonts.bold, fontSize: 17, lineHeight: 25 },
  label: { fontFamily: DuoFonts.extraBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.6 },
  caption: { fontFamily: DuoFonts.bold, fontSize: 14, lineHeight: 19 },
});

/** Text in the app font. Defaults to the theme's main text colour. */
export function DuoText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const t = useDuo();
  return <Text style={[variants[variant], { color: color ?? t.text }, style]} {...rest} />;
}
