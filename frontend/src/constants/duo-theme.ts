/** Bright, chunky, Duolingo-inspired design tokens, with light and night palettes. */

/** Brand colours stay the same in both modes. Each has a darker "edge" shade for 3D buttons. */
export const Brand = {
  green: '#58CC02',
  greenDark: '#58A700',
  blue: '#1CB0F6',
  blueDark: '#1899D6',
  orange: '#FF9600',
  orangeDark: '#CD7900',
  red: '#FF4B4B',
  redDark: '#EA2B2B',
  yellow: '#FFC800',
  yellowDark: '#E5A400',
  purple: '#CE82FF',
  purpleDark: '#A568CC',
  /** Text/icons drawn on top of a brand colour. */
  onColor: '#FFFFFF',
} as const;

export const Radius = { sm: 12, md: 16, lg: 20, xl: 28 } as const;

export interface DuoTheme {
  dark: boolean;
  // Neutrals
  background: string;
  /** Cards, chips, white buttons. */
  card: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  locked: string;
  lockedDark: string;
  lockedText: string;
  /** Readable accent text on soft (tinted) backgrounds. */
  blueText: string;
  greenText: string;
  /** Brand colours + radius, so components only need the theme object. */
  brand: typeof Brand;
  radius: typeof Radius;
  /** A soft background version of a colour (pastel in light mode, deep tone at night). */
  soft: (hex: string, amount?: number) => string;
}

export const lightTheme: DuoTheme = {
  dark: false,
  background: '#FFFFFF',
  card: '#FFFFFF',
  surface: '#F7F7F7',
  border: '#E5E5E5',
  text: '#3C3C3C',
  textMuted: '#777777',
  locked: '#E5E5E5',
  lockedDark: '#CECECE',
  lockedText: '#AFAFAF',
  blueText: Brand.blueDark,
  greenText: Brand.greenDark,
  brand: Brand,
  radius: Radius,
  soft: (hex, amount = 0.86) => mix(hex, '#FFFFFF', amount),
};

/** Night palette inspired by Duolingo's dark mode. */
export const darkTheme: DuoTheme = {
  dark: true,
  background: '#131F24',
  card: '#131F24',
  surface: '#202F36',
  border: '#37464F',
  text: '#F1F7FB',
  textMuted: '#A1B1B9',
  locked: '#37464F',
  lockedDark: '#26343B',
  lockedText: '#6B7F88',
  blueText: '#49C0F8',
  greenText: '#79D634',
  brand: Brand,
  radius: Radius,
  soft: (hex, amount = 0.8) => mix(hex, '#131F24', amount),
};

/** Font families loaded in src/app/_layout.tsx (Nunito ≈ Duolingo's rounded look). */
export const DuoFonts = {
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0')}`;
}

/** Mix `hex` towards `target` by `amount` (0 = hex, 1 = target). */
export function mix(hex: string, target: string, amount: number): string {
  const [r1, g1, b1] = toRgb(hex);
  const [r2, g2, b2] = toRgb(target);
  return toHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

/** Darken a hex colour, used to build the 3D bottom edge of buttons and nodes. */
export function shade(hex: string, amount = 0.18): string {
  return mix(hex, '#000000', amount);
}

/** Lighten a hex colour towards white. */
export function tint(hex: string, amount = 0.8): string {
  return mix(hex, '#FFFFFF', amount);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
