import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageProvider } from '../hooks/useLanguage';

// Global Fetch Bypass for localtunnel & ngrok warning screens
const originalFetch = global.fetch;
global.fetch = function (input: any, init?: any) {
  const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
  if (url.includes('loca.lt') || url.includes('ngrok')) {
    init = init || {};
    init.headers = init.headers || {};
    if (init.headers instanceof Headers) {
      init.headers.set('bypass-tunnel-reminder', 'true');
      init.headers.set('ngrok-skip-browser-warning', 'true');
    } else if (Array.isArray(init.headers)) {
      init.headers.push(['bypass-tunnel-reminder', 'true']);
      init.headers.push(['ngrok-skip-browser-warning', 'true']);
    } else {
      init.headers['bypass-tunnel-reminder'] = 'true';
      init.headers['ngrok-skip-browser-warning'] = 'true';
    }
  }
  return originalFetch(input, init);
};

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

// Android 16 (targetSdk 36) always draws the app edge-to-edge — the
// windowOptOutEdgeToEdgeEnforcement escape hatch is ignored — so the navigation
// bar sits on top of bottom-anchored UI unless we pad for it. Screens already
// pad their top by StatusBar.currentHeight, and iOS keeps using SafeAreaView,
// so this only handles the Android bottom inset.
function EdgeToEdgeContainer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000000',
        paddingBottom: Platform.OS === 'android' ? insets.bottom : 0,
      }}
    >
      {children}
    </View>
  );
}

export default function RootLayout() {
  usePhonePortraitLock();

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="light" />
        <EdgeToEdgeContainer>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="care" />
        <Stack.Screen name="offers" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="safety" />
        <Stack.Screen name="child-safety" />
        <Stack.Screen name="report-vulnerability" />
      </Stack>
        </EdgeToEdgeContainer>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
