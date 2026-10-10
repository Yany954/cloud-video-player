// The colours of Cloud Video Player, by what they are for. One set for light and one for dark;
// which one is shown follows the phone's or the browser's setting.
//
// The website draws from apps/web/src/app/globals.css (OKLCH, for Tailwind); these are the
// same colours in sRGB, which React Native needs. A test in apps/web keeps the two equal.

export interface ColorTokens {
  /** Behind everything. */
  background: string;
  /** Cards, inputs, the tab bar: one step up from the background. */
  surface: string;
  /** A second step up: chips, pressed rows, placeholders. */
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  /** The one strong colour: primary buttons, the active tab, "now playing". Used sparingly. */
  accent: string;
  /** Text and icons on top of the accent. */
  accentForeground: string;
  border: string;
  /** The outline of a text box: stronger than `border`, so the box is findable (WCAG 1.4.11). */
  inputBorder: string;
  danger: string;
  success: string;
}

export const LIGHT_COLORS: ColorTokens = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceElevated: '#EFF0F3',
  textPrimary: '#0F1216',
  textSecondary: '#636363',
  accent: '#1957D2',
  accentForeground: '#FAFAFA',
  border: '#DCDEE1',
  inputBorder: '#83868C',
  danger: '#CD0011',
  success: '#15803D',
};

export const DARK_COLORS: ColorTokens = {
  background: '#0B0D12',
  surface: '#13161C',
  surfaceElevated: '#21242A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A4A4A4',
  accent: '#6FA2FF',
  accentForeground: '#0B0D12',
  border: '#2B2E34',
  inputBorder: '#606369',
  danger: '#FD7273',
  success: '#4ADE80',
};

/** Corner radii, in points/pixels. Large and soft everywhere. */
export const RADIUS = { control: 12, card: 22, pill: 999 } as const;

/**
 * What each event theme looks like: a dark base, a main colour and a second colour. All bases
 * are dark, so white text over them stays readable (WCAG AA).
 */
export const EVENT_THEME_COLORS = {
  stage: ['#0b1230', '#2447d6', '#c2630c'],
  sunset: ['#2a0f2e', '#c2410c', '#f59e0b'],
  forest: ['#06221a', '#15803d', '#a3a316'],
  ocean: ['#041c2c', '#0e7490', '#38bdf8'],
  ember: ['#1f0a0a', '#b91c1c', '#ea580c'],
  violet: ['#170f33', '#6d28d9', '#db2777'],
  gold: ['#1c1503', '#a16207', '#eab308'],
  steel: ['#0f1418', '#475569', '#94a3b8'],
} as const satisfies Record<string, readonly [string, string, string]>;

/** WCAG relative luminance contrast between two `#RRGGBB` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
