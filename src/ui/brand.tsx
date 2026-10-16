import { Image } from 'expo-image';
import { radius } from './theme';

/** The Riffs logo tile: the R with a record, on its own black square. Reads the same in light and dark mode. */
export function RiffsLogo({ size = 56 }: { size?: number }) {
  return <Image source={require('../../assets/brand/riffs-logo-small.png')} style={{ width: size, height: size, borderRadius: size >= 48 ? radius.md : radius.xs + 2 }} contentFit="cover" accessibilityLabel="Riffs" accessibilityRole="image" />;
}
