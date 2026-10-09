import { Image } from 'expo-image';
import { useTheme } from './theme';

/** The Riffs wordmark, tinted to the current text colour so it reads in light and dark mode. */
export function RiffsWordmark({ width = 112 }: { width?: number }) {
  const { c } = useTheme();
  return <Image source={require('../../assets/brand/riffs-wordmark.png')} tintColor={c.text} style={{ width, height: width * 148 / 430 }} contentFit="contain" accessibilityLabel="Riffs" accessibilityRole="image" />;
}
