import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { I18nProvider, useI18n } from '@/i18n/i18n';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
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
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
