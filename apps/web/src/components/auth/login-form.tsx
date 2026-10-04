'use client';

import { ArrowRight, LoaderCircle, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { takeReturnTo } from '@/lib/auth/return-to';
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
import { useI18n } from '@/lib/i18n/i18n-context';
import { PasswordField } from './password-field';

const MIN_PASSWORD_LENGTH = 12;

export function LoginForm() {
  const { state, signIn, completeNewPassword } = useAuth();
  const { t } = useI18n();
  const a = t.auth;
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<
    'credentials' | 'newPassword' | 'signUp' | 'confirmEmail' | 'forgot' | 'reset'
  >('credentials');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (state.status !== 'signedIn') return;
    // Back to the page that sent the visitor here, e.g. an invite link.
    const path = takeReturnTo();
    // An invite link carries its secret after "#". A full page load guarantees the secret is
    // in the address before the page reads it; a client-side navigation applies it too late.
    if (path.includes('#')) window.location.replace(path);
    else router.replace(path);
  }, [state.status, router]);

  // The landing page's "Create an account" button links to /login#create.
  useEffect(() => {
    if (window.location.hash !== '#create') return;
    const timer = window.setTimeout(() => setStep('signUp'), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Move keyboard and screen-reader focus to the new step's heading.
  useEffect(() => {
    if (step !== 'credentials') headingRef.current?.focus();
  }, [step]);

  const mismatch =
    confirmation.length > 0 && confirmation !== newPassword ? a.passwordsDoNotMatch : '';

  function advance(next: SignInStep) {
    if (next === 'newPasswordRequired') setStep('newPassword');
    else if (next === 'confirmEmail') setStep('confirmEmail');
    else if (next === 'unsupported' && step !== 'forgot') {
      setError(a.unsupportedStep);
    }
  }

  async function submit(event: React.FormEvent, action: () => Promise<SignInStep>) {
    event.preventDefault();
    setError(null);
    setNotice('');
    setPending(true);
    try {
      advance(await action());
    } catch (caught) {
      setError(authErrorMessage(caught, t.authErrors));
    } finally {
      setPending(false);
    }
  }

  function go(next: typeof step) {
    setError(null);
    setNotice('');
    setStep(next);
  }

  if (step === 'signUp') {
    return (
      <form
        onSubmit={(event) => {
          if (mismatch) return event.preventDefault();
          if (!consent) {
            event.preventDefault();
            setError(t.legal.consentMissing);
            return;
          }
          void submit(event, async () => {
            await signUp(email, newPassword);
            return 'confirmEmail';
          });
        }}
        className="grid gap-6"
      >
        <div className="grid gap-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {a.signUp.title}
          </h1>
          <p className="text-muted-foreground text-sm">{a.signUp.intro}</p>
        </div>
        <EmailField value={email} onChange={setEmail} autoComplete="email" label={a.email} />
        <PasswordField
          id="new-password"
          label={a.password}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={MIN_PASSWORD_LENGTH}
          hint={a.passwordHint(MIN_PASSWORD_LENGTH)}
        />
        <PasswordField
          id="confirm-password"
          label={a.signUp.repeatPassword}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch || undefined}
        />
        <div className="flex items-start gap-3">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            aria-describedby={error === t.legal.consentMissing ? 'form-error' : undefined}
            className="accent-primary mt-0.5 size-5 shrink-0"
          />
          <label htmlFor="consent" className="text-sm leading-relaxed">
            {t.legal.consentBefore} <ConsentLink href="/terms" label={t.legal.terms} />{' '}
            {t.legal.consentBetween} <ConsentLink href="/privacy" label={t.legal.privacy} />
            {t.legal.consentAfter}
          </label>
        </div>
        <FormError message={error} />
        <SubmitButton
          pending={pending}
          label={a.signUp.submit}
          pendingLabel={a.signUp.submitting}
        />
        <SwitchLink
          text={a.signUp.haveAccount}
          action={a.signUp.signIn}
          onClick={() => go('credentials')}
        />
      </form>
    );
  }

  if (step === 'forgot') {
    return (
      <form
        onSubmit={(event) =>
          void submit(event, async () => {
            await requestPasswordReset(email);
            setCode('');
            setNewPassword('');
            setConfirmation('');
            setStep('reset');
            // Not signed in yet: the next screen asks for the code.
            return 'unsupported';
          })
        }
        className="grid gap-6"
      >
        <div className="grid gap-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {a.forgot.title}
          </h1>
          <p className="text-muted-foreground text-sm">{a.forgot.intro}</p>
        </div>
        <EmailField value={email} onChange={setEmail} autoComplete="username" label={a.email} />
        <FormError message={error} />
        <SubmitButton
          pending={pending}
          label={a.forgot.submit}
          pendingLabel={a.forgot.submitting}
        />
        <SwitchLink
          text={a.forgot.remembered}
          action={a.forgot.signIn}
          onClick={() => go('credentials')}
        />
      </form>
    );
  }

  if (step === 'reset') {
    return (
      <form
        onSubmit={(event) => {
          if (mismatch) return event.preventDefault();
          void submit(event, async () => {
            await confirmPasswordReset(email, code.trim(), newPassword);
            return signIn(email, newPassword);
          });
        }}
        className="grid gap-6"
      >
        <div className="grid gap-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {a.reset.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {a.reset.introBefore} <span translate="no">{email}</span> {a.reset.introAfter}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">{a.reset.code}</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            className="h-11 text-base tracking-widest tabular-nums"
          />
        </div>
        <PasswordField
          id="new-password"
          label={a.reset.newPassword}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={MIN_PASSWORD_LENGTH}
          hint={a.passwordHint(MIN_PASSWORD_LENGTH)}
        />
        <PasswordField
          id="confirm-password"
          label={a.reset.repeatNewPassword}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch || undefined}
        />
        <FormError message={error} />
        <SubmitButton pending={pending} label={a.reset.submit} pendingLabel={a.reset.submitting} />
        <SwitchLink text={a.reset.noEmail} action={a.reset.resend} onClick={() => go('forgot')} />
      </form>
    );
  }

  if (step === 'confirmEmail') {
    // After sign-up the password is in `newPassword`; after a sign-in attempt, in `password`.
    const knownPassword = newPassword || password;
    return (
      <form
        onSubmit={(event) =>
          void submit(event, async () => {
            await confirmSignUp(email, code.trim());
            return signIn(email, knownPassword);
          })
        }
        className="grid gap-6"
      >
        <div className="grid gap-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {a.confirmEmail.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {a.confirmEmail.introBefore} <span translate="no">{email}</span>
            {a.confirmEmail.introAfter}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">{a.confirmEmail.code}</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            className="h-11 text-base tracking-widest tabular-nums"
          />
        </div>
        <FormError message={error} />
        <p role="status" className="text-sm empty:hidden">
          {notice}
        </p>
        <SubmitButton
          pending={pending}
          label={a.confirmEmail.submit}
          pendingLabel={a.confirmEmail.submitting}
        />
        <SwitchLink
          text={a.confirmEmail.noEmail}
          action={a.confirmEmail.resend}
          onClick={() => {
            setError(null);
            resendSignUpCode(email).then(
              () => setNotice(a.confirmEmail.resent),
              (caught: unknown) => setError(authErrorMessage(caught, t.authErrors)),
            );
          }}
        />
      </form>
    );
  }

  if (step === 'newPassword') {
    return (
      <form
        onSubmit={(event) => {
          if (mismatch) return event.preventDefault();
          void submit(event, () => completeNewPassword(newPassword));
        }}
        className="grid gap-6"
      >
        <div className="grid gap-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {a.newPassword.title}
          </h1>
          <p className="text-muted-foreground text-sm">{a.newPassword.intro}</p>
        </div>
        <PasswordField
          id="new-password"
          label={a.newPassword.newPassword}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={MIN_PASSWORD_LENGTH}
          hint={a.passwordHint(MIN_PASSWORD_LENGTH)}
        />
        <PasswordField
          id="confirm-password"
          label={a.newPassword.repeatNewPassword}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch || undefined}
        />
        <FormError message={error} />
        <SubmitButton
          pending={pending}
          label={a.newPassword.submit}
          pendingLabel={a.newPassword.submitting}
        />
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event, () => signIn(email, password))}
      className="grid gap-6"
    >
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{a.signIn.title}</h1>
        <p className="text-muted-foreground text-sm">{a.signIn.intro}</p>
      </div>
      <EmailField value={email} onChange={setEmail} autoComplete="username" label={a.email} />
      <PasswordField
        id="password"
        label={a.password}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <FormError message={error} />
      <SubmitButton pending={pending} label={a.signIn.submit} pendingLabel={a.signIn.submitting} />
      <div className="grid gap-2">
        <SwitchLink
          text={a.signIn.cantSignIn}
          action={a.signIn.resetPassword}
          onClick={() => go('forgot')}
        />
        <SwitchLink
          text={a.signIn.newHere}
          action={a.signIn.createAccount}
          onClick={() => go('signUp')}
        />
      </div>
    </form>
  );
}

function EmailField(props: {
  value: string;
  onChange(value: string): void;
  autoComplete: 'username' | 'email';
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="email">{props.label}</Label>
      <div className="relative">
        <Mail
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        />
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete={props.autoComplete}
          inputMode="email"
          spellCheck={false}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          required
          className="h-11 pl-10"
        />
      </div>
    </div>
  );
}

function SwitchLink(props: { text: string; action: string; onClick(): void }) {
  return (
    <p className="text-muted-foreground text-sm">
      {props.text}{' '}
      <button
        type="button"
        onClick={props.onClick}
        className="text-primary focus-visible:ring-ring/50 rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
      >
        {props.action}
      </button>
    </p>
  );
}

/** Opens in a new tab, so what was typed in the form is not lost. */
function ConsentLink({ href, label }: { href: string; label: string }) {
  const { t } = useI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="text-primary focus-visible:ring-ring/50 rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3"
    >
      {label}
      <span className="sr-only"> {t.legal.opensInNewTab}</span>
    </a>
  );
}

function FormError({ message }: { message: string | null }) {
  // Always in the DOM so screen readers announce the message when it appears.
  return (
    <p id="form-error" role="alert" className="text-destructive text-sm empty:hidden">
      {message}
    </p>
  );
}

function SubmitButton(props: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <Button type="submit" size="lg" disabled={props.pending} className="h-11 w-full">
      {props.pending ? (
        <>
          <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
          {props.pendingLabel}
        </>
      ) : (
        <>
          {props.label}
          <ArrowRight aria-hidden />
        </>
      )}
    </Button>
  );
}
