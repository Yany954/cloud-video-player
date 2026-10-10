import { EVENT_THEME_COLORS } from '@cvp/shared';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '@/components/brand';
import { useI18n } from '@/i18n/i18n';
import { env } from '@/lib/env';
import { MIN_TOUCH, radius, useColors } from '@/theme';

/**
 * The first screen for someone who is not signed in: what the app is, and the two ways in.
 * Not a marketing page. Nothing private is ever shown here.
 */
export default function WelcomeScreen() {
  const { t } = useI18n();
  const w = t.welcome;
  const c = useColors();
  const router = useRouter();

  const legal = (page: 'privacy' | 'terms') =>
    void WebBrowser.openBrowserAsync(`${env.webUrl}/${page}`);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <Brand />
        <Hero />
        <View style={styles.words}>
          <Text accessibilityRole="header" style={[styles.slogan, { color: c.foreground }]}>
            {w.slogan}
          </Text>
          <Text style={[styles.support, { color: c.mutedForeground }]}>{w.support}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="get-started"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'create' } })}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: c.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryText, { color: c.primaryForeground }]}>{w.getStarted}</Text>
          </Pressable>
          <View style={styles.signIn}>
            <Text style={[styles.support, { color: c.mutedForeground }]}>{w.haveAccount}</Text>
            <Pressable
              testID="go-sign-in"
              accessibilityRole="link"
              onPress={() => router.push('/sign-in')}
              hitSlop={12}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.support, styles.link, { color: c.primary }]}>{w.signIn}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <FooterLink
            label={t.legal.privacy}
            hint={t.legal.opensInBrowser}
            onPress={() => legal('privacy')}
          />
          <Text style={[styles.small, { color: c.mutedForeground }]} accessible={false}>
            ·
          </Text>
          <FooterLink
            label={t.legal.terms}
            hint={t.legal.opensInBrowser}
            onPress={() => legal('terms')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * The picture at the top. Until a photo is added to assets/images/welcome, it is drawn: the
 * "stage" event colours as soft lights over a dark base, with a play mark, like a venue
 * before the show. Always dark, in light mode too, so it reads as a screen.
 */
function Hero() {
  const [base, main, second] = EVENT_THEME_COLORS.stage;
  return (
    <View style={styles.hero} accessible={false} importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[base, '#05070F']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[`${main}E6`, `${main}00`]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.75, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${second}00`, `${second}B3`]}
        start={{ x: 0.35, y: 0.35 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* A scrim at the bottom, where a caption would sit over a photo. */}
      <LinearGradient
        colors={['#00000000', '#000000A6']}
        start={{ x: 0.5, y: 0.45 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.play}>
        <Ionicons name="play" size={34} color="#FFFFFF" style={styles.playIcon} />
      </View>
    </View>
  );
}

function FooterLink(props: { label: string; hint: string; onPress(): void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={props.hint}
      onPress={props.onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
    >
      <Text style={[styles.small, { color: c.mutedForeground }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    gap: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 6,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  hero: {
    flex: 1,
    minHeight: 180,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF26',
    borderWidth: 1,
    borderColor: '#FFFFFF4D',
  },
  playIcon: { marginLeft: 4 },
  words: { gap: 8 },
  slogan: { fontSize: 32, fontWeight: '800', letterSpacing: -0.9, lineHeight: 37 },
  support: { fontSize: 16, lineHeight: 23 },
  actions: { gap: 14 },
  primary: {
    minHeight: MIN_TOUCH + 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryText: { fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  signIn: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 6 },
  link: { fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  footerLink: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 6 },
  small: { fontSize: 13, lineHeight: 18 },
});
