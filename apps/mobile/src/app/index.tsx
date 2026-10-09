import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Title } from '@/components/ui';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { useColors } from '@/theme';

/**
 * Signed-in home, for now: who is signed in, and one real call to the API with their token.
 * The video lists replace this in step 3.
 */
export default function HomeScreen() {
  const { state, signOut } = useAuth();
  const { t } = useI18n();
  const c = useColors();
  const [count, setCount] = useState<number | 'failed' | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.listVideos().then(
      ({ videos }) => active && setCount(videos.length),
      () => active && setCount('failed'),
    );
    return () => {
      active = false;
    };
  }, []);

  if (state.status !== 'signedIn') return null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <Title>{t.common.appName}</Title>
        <View style={styles.block}>
          <Body muted>{t.home.signedInAs}</Body>
          <Body>{state.user.email}</Body>
          {state.user.isAdmin && <Body muted>{t.home.admin}</Body>}
        </View>
        <View testID="video-count">
          <Body>
            {count === null
              ? `${t.common.loading}…`
              : count === 'failed'
                ? t.home.videosFailed
                : t.home.videos(count)}
          </Body>
        </View>
        <Body muted>{t.home.comingNext}</Body>
        <Button
          testID="sign-out"
          variant="outline"
          label={t.home.signOut}
          busy={leaving}
          onPress={() => {
            setLeaving(true);
            void signOut().finally(() => setLeaving(false));
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: 20, paddingHorizontal: 24 },
  block: { gap: 2 },
});
