import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

// On Android, the hardware back button on a portal dashboard must exit the
// app instead of popping the navigation stack back to the login screens,
// which looked like being logged out.
export function useHardwareBackExit() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);
}
