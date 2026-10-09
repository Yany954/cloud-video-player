import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Button } from '@/components/ui';
import { useI18n } from '@/i18n/i18n';
import { useAuth } from '@/lib/auth/auth-context';
import { useColors } from '@/theme';

export default function AccountScreen() {
  const { state, signOut } = useAuth();
  const { t } = useI18n();
  const c = useColors();
  const [leaving, setLeaving] = useState(false);

  if (state.status !== 'signedIn') return null;

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.block}>
        <Body muted>{t.account.signedInAs}</Body>
        <Body>{state.user.email}</Body>
        {state.user.isAdmin && <Body muted>{t.account.admin}</Body>}
      </View>
      <Body muted>{t.account.more}</Body>
      <Button
        testID="sign-out"
        variant="outline"
        label={t.account.signOut}
        busy={leaving}
        onPress={() => {
          setLeaving(true);
          void signOut().finally(() => setLeaving(false));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 20, paddingHorizontal: 20, paddingTop: 12 },
  block: { gap: 2 },
});
