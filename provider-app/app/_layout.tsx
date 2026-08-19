import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Android 16 ignores manifest orientation locks on large screens, and Play flags the
// lock as a large-screen restriction, so the manifest no longer pins portrait.
// Phones keep the portrait-only experience the layouts are designed for; tablets
// and foldables (>= 600dp shortest side) are free to rotate.
function usePhonePortraitLock() {
  useEffect(() => {
    const { width, height } = Dimensions.get('window');
    if (Math.min(width, height) >= 600) return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
      // Large-screen devices on Android 16 reject the lock; nothing to do.
    });
  }, []);
}

export default function Layout() {
  usePhonePortraitLock();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'Login' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
