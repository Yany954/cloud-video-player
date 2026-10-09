import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Checkbox, ErrorText, Field, LinkButton, Title } from '@/components/ui';
import { useI18n } from '@/i18n/i18n';
import { useAuth } from '@/lib/auth/auth-context';
import {
  confirmPasswordReset,
  confirmSignUp,
  requestPasswordReset,
  resendSignUpCode,
  signUp,
  type SignInStep,
} from '@/lib/auth/cognito';
import { authErrorMessage } from '@/lib/auth/errors';
import { env } from '@/lib/env';
import { useColors } from '@/theme';

const MIN_PASSWORD_LENGTH = 12;

type Step = 'credentials' | 'newPassword' | 'signUp' | 'confirmEmail' | 'forgot' | 'reset';

/**
 * Sign in, create an account, confirm the email, and reset a password: the same steps, rules
 * and wording as the website's sign-in page. When a step ends signed in, the root layout shows
 * the app instead of this screen.
 */
export function AuthFlow() {
  const { t } = useI18n();
  const a = t.auth;
  const c = useColors();
  const { signIn, completeNewPassword } = useAuth();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  const mismatch = confirmation.length > 0 && confirmation !== newPassword;
  const tooShort = newPassword.length < MIN_PASSWORD_LENGTH;
  const cleanEmail = email.trim();

  function go(next: Step) {
    setError(null);
    setNotice('');
    setStep(next);
  }

  /** Runs one step; `action` says where the sign-in stands afterwards. */
  async function run(action: () => Promise<SignInStep | 'stay'>) {
    setError(null);
    setNotice('');
    setPending(true);
    try {
      const next = await action();
      if (next === 'newPasswordRequired') setStep('newPassword');
      else if (next === 'confirmEmail') setStep('confirmEmail');
      else if (next === 'unsupported') setError(a.unsupportedStep);
    } catch (caught) {
      setError(authErrorMessage(caught, t.authErrors));
    } finally {
      setPending(false);
    }
  }

  const openLegal = (page: 'terms' | 'privacy') =>
    void WebBrowser.openBrowserAsync(`${env.webUrl}/${page}`);

  const passwordSecret = { show: t.common.show, hide: t.common.hide };
  const newPasswordFields = (labels: { password: string; repeat: string }) => (
    <>
      <Field
        testID="new-password"
        label={labels.password}
        hint={a.passwordHint(MIN_PASSWORD_LENGTH)}
        value={newPassword}
        onChangeText={setNewPassword}
        secret={passwordSecret}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <Field
        testID="confirm-password"
        label={labels.repeat}
        value={confirmation}
        onChangeText={setConfirmation}
        secret={passwordSecret}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      {mismatch && <ErrorText>{a.passwordsDoNotMatch}</ErrorText>}
    </>
  );
  const codeField = (label: string) => (
    <Field
      testID="code"
      label={label}
      value={code}
      onChangeText={setCode}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
    />
  );
  const emailField = (
    <Field
      testID="email"
      label={a.email}
      value={email}
      onChangeText={setEmail}
      keyboardType="email-address"
      textContentType="username"
      autoComplete="email"
    />
  );

  let content: React.ReactNode;
  if (step === 'signUp') {
    content = (
      <>
        <Heading title={a.signUp.title} intro={a.signUp.intro} />
        {emailField}
        {newPasswordFields({ password: a.password, repeat: a.signUp.repeatPassword })}
        <Checkbox
          checked={consent}
          onChange={setConsent}
          label={`${t.legal.consentBefore} ${t.legal.terms} ${t.legal.consentBetween} ${t.legal.privacy}`}
        >
          <Text style={[styles.consent, { color: c.foreground }]}>
            {t.legal.consentBefore}{' '}
            <Text
              accessibilityRole="link"
              accessibilityHint={t.legal.opensInBrowser}
              style={styles.underline}
              onPress={() => openLegal('terms')}
            >
              {t.legal.terms}
            </Text>{' '}
            {t.legal.consentBetween}{' '}
            <Text
              accessibilityRole="link"
              accessibilityHint={t.legal.opensInBrowser}
              style={styles.underline}
              onPress={() => openLegal('privacy')}
            >
              {t.legal.privacy}
            </Text>
            {t.legal.consentAfter}
          </Text>
        </Checkbox>
        <ErrorText>{error}</ErrorText>
        <Button
          testID="submit"
          label={pending ? a.signUp.submitting : a.signUp.submit}
          busy={pending}
          disabled={!cleanEmail || tooShort || mismatch || confirmation.length === 0}
          onPress={() => {
            if (!consent) return setError(t.legal.consentMissing);
            void run(async () => {
              await signUp(cleanEmail, newPassword);
              setCode('');
              return 'confirmEmail';
            });
          }}
        />
        <Switch
          text={a.signUp.haveAccount}
          link={a.signUp.signIn}
          onPress={() => go('credentials')}
        />
      </>
    );
  } else if (step === 'confirmEmail') {
    // After creating an account the password is the new one; after a sign-in, the typed one.
    const knownPassword = newPassword || password;
    content = (
      <>
        <Heading
          title={a.confirmEmail.title}
          intro={`${a.confirmEmail.introBefore} ${cleanEmail}${a.confirmEmail.introAfter}`}
        />
        {codeField(a.confirmEmail.code)}
        <ErrorText>{error}</ErrorText>
        <Notice text={notice} />
        <Button
          testID="submit"
          label={pending ? a.confirmEmail.submitting : a.confirmEmail.submit}
          busy={pending}
          disabled={code.trim().length === 0}
          onPress={() =>
            void run(async () => {
              await confirmSignUp(cleanEmail, code.trim());
              return signIn(cleanEmail, knownPassword);
            })
          }
        />
        <Switch
          text={a.confirmEmail.noEmail}
          link={a.confirmEmail.resend}
          onPress={() =>
            void run(async () => {
              await resendSignUpCode(cleanEmail);
              setNotice(a.confirmEmail.resent);
              return 'stay';
            })
          }
        />
      </>
    );
  } else if (step === 'forgot') {
    content = (
      <>
        <Heading title={a.forgot.title} intro={a.forgot.intro} />
        {emailField}
        <ErrorText>{error}</ErrorText>
        <Button
          testID="submit"
          label={pending ? a.forgot.submitting : a.forgot.submit}
          busy={pending}
          disabled={!cleanEmail}
          onPress={() =>
            void run(async () => {
              await requestPasswordReset(cleanEmail);
              setCode('');
              setNewPassword('');
              setConfirmation('');
              setStep('reset');
              return 'stay';
            })
          }
        />
        <Switch
          text={a.forgot.remembered}
          link={a.forgot.signIn}
          onPress={() => go('credentials')}
        />
      </>
    );
  } else if (step === 'reset') {
    content = (
      <>
        <Heading
          title={a.reset.title}
          intro={`${a.reset.introBefore} ${cleanEmail} ${a.reset.introAfter}`}
        />
        {codeField(a.reset.code)}
        {newPasswordFields({ password: a.reset.newPassword, repeat: a.reset.repeatNewPassword })}
        <ErrorText>{error}</ErrorText>
        <Notice text={notice} />
        <Button
          testID="submit"
          label={pending ? a.reset.submitting : a.reset.submit}
          busy={pending}
          disabled={code.trim().length === 0 || tooShort || mismatch || confirmation.length === 0}
          onPress={() =>
            void run(async () => {
              await confirmPasswordReset(cleanEmail, code.trim(), newPassword);
              return signIn(cleanEmail, newPassword);
            })
          }
        />
        <Switch
          text={a.reset.noEmail}
          link={a.reset.resend}
          onPress={() =>
            void run(async () => {
              await requestPasswordReset(cleanEmail);
              setNotice(a.confirmEmail.resent);
              return 'stay';
            })
          }
        />
      </>
    );
  } else if (step === 'newPassword') {
    content = (
      <>
        <Heading title={a.newPassword.title} intro={a.newPassword.intro} />
        {newPasswordFields({
          password: a.newPassword.newPassword,
          repeat: a.newPassword.repeatNewPassword,
        })}
        <ErrorText>{error}</ErrorText>
        <Button
          testID="submit"
          label={pending ? a.newPassword.submitting : a.newPassword.submit}
          busy={pending}
          disabled={tooShort || mismatch || confirmation.length === 0}
          onPress={() => void run(() => completeNewPassword(newPassword))}
        />
      </>
    );
  } else {
    content = (
      <>
        <Heading title={a.signIn.title} intro={a.signIn.intro} />
        {emailField}
        <Field
          testID="password"
          label={a.password}
          value={password}
          onChangeText={setPassword}
          secret={passwordSecret}
          textContentType="password"
          autoComplete="current-password"
          onSubmitEditing={() => void run(() => signIn(cleanEmail, password))}
        />
        <ErrorText>{error}</ErrorText>
        <Button
          testID="submit"
          label={pending ? a.signIn.submitting : a.signIn.submit}
          busy={pending}
          disabled={!cleanEmail || password.length === 0}
          onPress={() => void run(() => signIn(cleanEmail, password))}
        />
        <Switch
          text={a.signIn.cantSignIn}
          link={a.signIn.resetPassword}
          onPress={() => go('forgot')}
        />
        <Switch
          text={a.signIn.newHere}
          link={a.signIn.createAccount}
          onPress={() => {
            setNewPassword('');
            setConfirmation('');
            go('signUp');
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // A new step starts at its heading.
          key={step}
        >
          <Text style={[styles.brand, { color: c.mutedForeground }]}>{t.common.appName}</Text>
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Heading({ title, intro }: { title: string; intro: string }) {
  return (
    <View style={styles.heading}>
      <Title>{title}</Title>
      <Body muted>{intro}</Body>
    </View>
  );
}

function Switch(props: { text: string; link: string; onPress(): void }) {
  return (
    <View style={styles.switch}>
      <Body muted>{props.text}</Body>
      <LinkButton label={props.link} onPress={props.onPress} />
    </View>
  );
}

/** Good news, e.g. "a new code is on its way": announced politely. */
function Notice({ text }: { text: string }) {
  const c = useColors();
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.consent, { color: c.foreground }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brand: { fontSize: 15, fontWeight: '600' },
  heading: { gap: 6 },
  switch: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, alignItems: 'center' },
  consent: { fontSize: 15, lineHeight: 22 },
  underline: { textDecorationLine: 'underline' },
});
