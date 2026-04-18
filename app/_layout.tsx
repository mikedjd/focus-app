import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAppBootstrap } from '../src/api/client';
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
