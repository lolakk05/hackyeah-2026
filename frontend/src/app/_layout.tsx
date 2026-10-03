import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { theme } from '@/constants/duo-theme';
import { AchievementToast } from '@/components/account/achievement-toast';
import { LanguageProvider } from '@/i18n/language-context';
import { AccountProvider } from '@/state/account-context';
import { JourneyProvider } from '@/state/journey-context';
import { ReportsProvider } from '@/state/reports-context';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.background,
    card: theme.background,
    border: theme.border,
    text: theme.text,
    primary: theme.brand.primary,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageProvider>
        <AccountProvider>
          <JourneyProvider>
            <ReportsProvider>
              <ThemeProvider value={navTheme}>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
                  {/* language → sign in → welcome → setup → roadmap → 3D map (→ place pages) */}
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" options={{ animation: 'fade' }} />
                  <Stack.Screen name="register" />
                  <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                  <Stack.Screen name="profile" />
                  <Stack.Screen name="ranking" />
                  <Stack.Screen name="rewards" />
                  <Stack.Screen name="reports" />
                  <Stack.Screen name="setup" />
                  <Stack.Screen name="roadmap" />
                  {/* no swipe-back on the map: one-finger drags rotate the camera */}
                  <Stack.Screen name="map" options={{ gestureEnabled: false, animation: 'fade' }} />
                  <Stack.Screen name="place/[id]" options={{ animation: 'slide_from_bottom' }} />
                </Stack>
                <AchievementToast />
              </ThemeProvider>
            </ReportsProvider>
          </JourneyProvider>
        </AccountProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
});
