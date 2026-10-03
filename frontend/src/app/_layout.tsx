import {
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { JourneyProvider } from '@/state/journey-context';
import { DuoThemeProvider, useDuo } from '@/state/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <DuoThemeProvider>
        <JourneyProvider>
          <AppStack />
        </JourneyProvider>
      </DuoThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const t = useDuo();
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: t.background, card: t.background, border: t.border, text: t.text },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }}>
        {/* start page → setup → roadmap → 3D map (→ place pages) */}
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="roadmap" />
        {/* no swipe-back on the map: one-finger drags rotate the camera */}
        <Stack.Screen name="map" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="place/[id]" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </ThemeProvider>
  );
}
