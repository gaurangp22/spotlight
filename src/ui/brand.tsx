import { Image } from 'expo-image';
import { View } from 'react-native';
import { radius, useTheme } from './theme';

/** The Riffs mark (the R holding a record), drawn in the text colour so it sits on any background. */
export function RiffsMark({ size = 32 }: { size?: number }) {
  const { dark } = useTheme();
  return <Image source={dark ? require('../../assets/brand/riffs-mark-white.png') : require('../../assets/brand/riffs-mark-black.png')}
    style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Riffs" accessibilityRole="image" />;
}

/** Mark plus the solid RIFFS wordmark, for headers. */
export function RiffsLockup({ height = 30 }: { height?: number }) {
  const { c } = useTheme();
  return <View accessible accessibilityRole="image" accessibilityLabel="Riffs" style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.22 }}>
    <RiffsMark size={height} />
    <Image source={require('../../assets/brand/riffs-wordmark.png')} tintColor={c.text} style={{ height: height * 0.62, width: height * 0.62 * 600 / 280 }} contentFit="contain" />
  </View>;
}

/** The app icon tile, for places that show the icon itself (sign in, invites). */
export function RiffsLogo({ size = 56 }: { size?: number }) {
  return <Image source={require('../../assets/brand/riffs-logo-small.png')} style={{ width: size, height: size, borderRadius: size >= 48 ? radius.md : radius.xs + 2 }} contentFit="cover" accessibilityLabel="Riffs" accessibilityRole="image" />;
}
