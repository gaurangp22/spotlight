import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a nicety: never let a missing motor or browser surface an error.
const native = Platform.OS !== 'web';
export const haptic = {
  tap: () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  press: () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  select: () => { if (native) Haptics.selectionAsync().catch(() => {}); },
  success: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warn: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};
