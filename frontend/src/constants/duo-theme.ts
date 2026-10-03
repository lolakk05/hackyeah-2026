/**
 * Design tokens: one calm dark theme ("Kraków at night"): deep navy surfaces,
 * a warm Kraków-gold accent and soft rounded cards. Uses the phone's own font.
 */

export const Brand = {
  /** Main accent (buttons, current stop). */
  primary: '#FFB547',
  primaryPressed: '#E89E2E',
  /** Text on the gold accent. */
  onPrimary: '#241703',
  sky: '#5CC8FF',
  success: '#3DDC97',
  danger: '#FF6B6B',
  violet: '#B79CFF',
  /** Text/icons drawn on top of a saturated colour. */
  onColor: '#FFFFFF',
} as const;

export const Radius = { sm: 10, md: 14, lg: 18, xl: 26 } as const;

export interface DuoTheme {
  background: string;
  surface: string;
  card: string;
  cardRaised: string;
  border: string;
  text: string;
  textMuted: string;
  locked: string;
  lockedDark: string;
  lockedText: string;
  brand: typeof Brand;
  radius: typeof Radius;
  /** A soft background version of a colour (mixed into the background). */
  soft: (hex: string, amount?: number) => string;
}

export const theme: DuoTheme = {
  background: '#0F1724',
  surface: '#141E2D',
  card: '#1A2537',
  cardRaised: '#223049',
  border: '#2A3850',
  text: '#F2F5FA',
  textMuted: '#93A2B8',
  locked: '#26334A',
  lockedDark: '#1D293C',
  lockedText: '#5F6E86',
  brand: Brand,
  radius: Radius,
  soft: (hex, amount = 0.78) => mix(hex, '#0F1724', amount),
};

/** Text styles use the system font (SF Pro on iPhone, Roboto on Android). */
export const FontWeights = {
  regular: '500',
  bold: '700',
  heavy: '800',
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

/** Darken a hex colour. */
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
