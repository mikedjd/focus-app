import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  getDb,
  dbRefreshResumeContext,
  dbIsReviewDue,
  dbIsOnboardingComplete,
} from '../src/db';
import { C } from '../src/constants/colors';
import { useAppStore } from '../src/store/useAppStore';

export default function RootLayout() {
  const appReady = useAppStore((s) => s.appReady);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const setAppReady = useAppStore((s) => s.setAppReady);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const setResumeContext = useAppStore((s) => s.setResumeContext);
  const setReviewDue = useAppStore((s) => s.setReviewDue);

  useEffect(() => {
    // Register service worker for PWA offline support on web
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failing is non-fatal (e.g. local dev)
      });
    }

    getDb();
    setOnboardingComplete(dbIsOnboardingComplete());
    setResumeContext(dbRefreshResumeContext());
    setReviewDue(dbIsReviewDue());
    setAppReady(true);
  }, [setAppReady, setOnboardingComplete, setResumeContext, setReviewDue]);

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
