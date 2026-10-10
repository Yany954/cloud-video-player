import '@/lib/polyfills';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { I18nProvider, useI18n } from '@/i18n/i18n';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { UploadsProvider } from '@/lib/upload/uploads-context';
import { useColors } from '@/theme';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <I18nProvider>
        <AuthProvider>
          <Screens />
        </AuthProvider>
      </I18nProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

/** Signed-out people only ever reach the sign-in screen; everything else needs a session. */
function Screens() {
  const { state } = useAuth();
  const { t } = useI18n();
  const c = useColors();

  // The saved session is being read from the phone's secure storage.
  if (state.status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator accessibilityLabel={t.common.loading} color={c.mutedForeground} />
      </View>
    );
  }

  const signedIn = state.status === 'signedIn';
  const screens = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerShadowVisible: false,
        headerBackTitle: t.common.back,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="videos/[videoId]" options={{ title: '' }} />
        <Stack.Screen name="events/[eventId]/index" options={{ title: '' }} />
        <Stack.Screen name="events/[eventId]/play" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        {/* A bare header: only the way back to the welcome screen. */}
        <Stack.Screen name="sign-in" options={{ title: '' }} />
      </Stack.Protected>
    </Stack>
  );
  // Uploads belong to the signed-in person and live above every screen. Keyed by the person:
  // another account never inherits someone else's upload list.
  return state.status === 'signedIn' ? (
    <UploadsProvider key={state.user.id} userId={state.user.id}>
      {screens}
    </UploadsProvider>
  ) : (
    screens
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
