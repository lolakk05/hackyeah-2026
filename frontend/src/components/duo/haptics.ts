import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Small tactile "tap" for big buttons (no-op on web). */
export function tapFeedback(strong = false) {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(
    () => {},
  );
}

export function successFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
