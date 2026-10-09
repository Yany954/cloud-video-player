import { useColorScheme } from 'react-native';

// The website's colours (apps/web/src/app/globals.css), converted from OKLCH to sRGB.
const light = {
  background: '#F9FAFB',
  foreground: '#0F1216',
  card: '#FFFFFF',
  primary: '#1957D2',
  primaryForeground: '#FAFAFA',
  muted: '#EFF0F3',
  mutedForeground: '#636363',
  destructive: '#CD0011',
  border: '#DCDEE1',
  input: '#83868C',
};

const dark: typeof light = {
  background: '#0B0D12',
  foreground: '#F5F5F5',
  card: '#13161C',
  primary: '#6FA2FF',
  primaryForeground: '#0B0D12',
  muted: '#21242A',
  mutedForeground: '#A4A4A4',
  destructive: '#FD7273',
  border: '#2B2E34',
  input: '#606369',
};

export type Colors = typeof light;

/** Follows the phone's light or dark appearance. */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { control: 10, card: 24 };
/** Apple and Google both ask for touch targets of at least 44 points. */
export const MIN_TOUCH = 44;
