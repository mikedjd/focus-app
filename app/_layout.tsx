import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAppBootstrap } from '../src/api/client';
import { C } from '../src/constants/colors';
import { useAppStore } from '../src/store/useAppStore';

const WEB_CACHE_CLEANUP_KEY = 'focus-web-cache-cleanup-v1';

export default function RootLayout() {
  const appReady = useAppStore((s) => s.appReady);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const setAppReady = useAppStore((s) => s.setAppReady);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const setResumeContext = useAppStore((s) => s.setResumeContext);
  const setReviewDue = useAppStore((s) => s.setReviewDue);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const bootstrap = await getAppBootstrap();
        if (cancelled) {
          return;
        }

        setOnboardingComplete(bootstrap.onboardingComplete);
        setResumeContext(bootstrap.resumeContext);
        setReviewDue(bootstrap.reviewDue);
      } finally {
        if (!cancelled) {
          setAppReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAppReady, setOnboardingComplete, setResumeContext, setReviewDue]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [hadRegistrations, hadCaches] = await Promise.all([
          (async () => {
            if (!('serviceWorker' in navigator)) {
              return false;
            }

            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
            return registrations.length > 0;
          })(),
          (async () => {
            if (typeof caches === 'undefined') {
              return false;
            }

            const cacheKeys = await caches.keys();
            const focusCacheKeys = cacheKeys.filter((key) => key.startsWith('focus-'));
            await Promise.all(focusCacheKeys.map((key) => caches.delete(key)));
            return focusCacheKeys.length > 0;
          })(),
        ]);

        if (cancelled) {
          return;
        }

        const needsReload = hadRegistrations || hadCaches;
        const hasReloaded = window.sessionStorage.getItem(WEB_CACHE_CLEANUP_KEY) === 'done';

        if (needsReload && !hasReloaded) {
          window.sessionStorage.setItem(WEB_CACHE_CLEANUP_KEY, 'done');
          window.location.reload();
        }
      } catch {
        // Ignore cleanup failures and continue booting the app.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!appReady) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="small" color={C.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {onboardingComplete ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="onboarding" />
        )}
        <Stack.Screen name="inbox" />
        <Stack.Screen name="parking-lot" />
        <Stack.Screen name="energy-windows" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="focus"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
});
