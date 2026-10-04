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
import { PasswordField } from './password-field';

const MIN_PASSWORD_LENGTH = 12;

export function LoginForm() {
  const { state, signIn, completeNewPassword } = useAuth();
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

  useEffect(() => {
    if (state.status !== 'signedIn') return;
    // Back to the page that sent the visitor here, e.g. an invite link.
    const path = takeReturnTo();
    // An invite link carries its secret after "#". A full page load guarantees the secret is
    // in the address before the page reads it; a client-side navigation applies it too late.
    if (path.includes('#')) window.location.replace(path);
    else router.replace(path);
  }, [state.status, router]);

  // Move keyboard and screen-reader focus to the new step's heading.
  useEffect(() => {
    if (step !== 'credentials') headingRef.current?.focus();
  }, [step]);

  const mismatch =
    confirmation.length > 0 && confirmation !== newPassword ? 'The passwords do not match.' : '';

  function advance(next: SignInStep) {
    if (next === 'newPasswordRequired') setStep('newPassword');
    else if (next === 'confirmEmail') setStep('confirmEmail');
    else if (next === 'unsupported' && step !== 'forgot') {
      setError('This account needs a sign-in step this app does not support yet.');
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
      setError(authErrorMessage(caught));
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
            Create your account
          </h1>
          <p className="text-muted-foreground text-sm">
            We will email you a code to confirm the address is yours.
          </p>
        </div>
        <EmailField value={email} onChange={setEmail} autoComplete="email" />
        <PasswordField
          id="new-password"
          label="Password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A few random words work well.`}
        />
        <PasswordField
          id="confirm-password"
          label="Repeat password"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch || undefined}
        />
        <FormError message={error} />
        <SubmitButton pending={pending} label="Create account" pendingLabel="Creating account" />
        <SwitchLink
          text="Already have an account?"
          action="Sign in"
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
            Forgot your password?
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your email and we will send you a code to choose a new one.
          </p>
        </div>
        <EmailField value={email} onChange={setEmail} autoComplete="username" />
        <FormError message={error} />
        <SubmitButton pending={pending} label="Send code" pendingLabel="Sending" />
        <SwitchLink text="Remembered it?" action="Sign in" onClick={() => go('credentials')} />
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
            Choose a new password
          </h1>
          <p className="text-muted-foreground text-sm">
            If <span translate="no">{email}</span> has an account, we sent it a 6-digit code. It can
            take a minute, and it may be in your spam folder.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">Code from the email</Label>
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
          label="New password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A few random words work well.`}
        />
        <PasswordField
          id="confirm-password"
          label="Repeat new password"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch || undefined}
        />
        <FormError message={error} />
        <SubmitButton pending={pending} label="Save and sign in" pendingLabel="Saving" />
        <SwitchLink text="No email yet?" action="Send a new code" onClick={() => go('forgot')} />
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
            Check your email
          </h1>
          <p className="text-muted-foreground text-sm">
            We sent a 6-digit code to <span translate="no">{email}</span>. It can take a minute, and
            it may be in your spam folder.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">Confirmation code</Label>
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
        <SubmitButton pending={pending} label="Confirm and sign in" pendingLabel="Confirming" />
        <SwitchLink
          text="No email yet?"
          action="Send a new code"
          onClick={() => {
            setError(null);
            resendSignUpCode(email).then(
              () => setNotice('A new code is on its way.'),
              (caught: unknown) => setError(authErrorMessage(caught)),
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
            Choose your password
          </h1>
          <p className="text-muted-foreground text-sm">
            Your temporary password worked. Now pick one that only you know.
          </p>
        </div>
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A few random words work well.`}
        />
        <PasswordField
          id="confirm-password"
          label="Repeat new password"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch || undefined}
        />
        <FormError message={error} />
        <SubmitButton pending={pending} label="Save and continue" pendingLabel="Saving" />
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event, () => signIn(email, password))}
      className="grid gap-6"
    >
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Use the email address and password of your account.
        </p>
      </div>
      <EmailField value={email} onChange={setEmail} autoComplete="username" />
      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <FormError message={error} />
      <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing in" />
      <div className="grid gap-2">
        <SwitchLink
          text="Can’t sign in?"
          action="Reset your password"
          onClick={() => go('forgot')}
        />
        <SwitchLink text="New here?" action="Create an account" onClick={() => go('signUp')} />
      </div>
    </form>
  );
}

function EmailField(props: {
  value: string;
  onChange(value: string): void;
  autoComplete: 'username' | 'email';
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="email">Email</Label>
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

function FormError({ message }: { message: string | null }) {
  // Always in the DOM so screen readers announce the message when it appears.
  return (
    <p role="alert" className="text-destructive text-sm empty:hidden">
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
