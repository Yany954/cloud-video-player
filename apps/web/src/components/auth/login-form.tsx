'use client';

import { ArrowRight, LoaderCircle, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { takeReturnTo } from '@/lib/auth/return-to';
import { useAuth } from '@/lib/auth/auth-context';
import type { SignInStep } from '@/lib/auth/cognito';
import { authErrorMessage } from '@/lib/auth/errors';
import { PasswordField } from './password-field';

const MIN_PASSWORD_LENGTH = 12;

export function LoginForm() {
  const { state, signIn, completeNewPassword } = useAuth();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<'credentials' | 'newPassword'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Back to the page that sent the visitor here, e.g. an invite link.
    if (state.status === 'signedIn') router.replace(takeReturnTo());
  }, [state.status, router]);

  // Move keyboard and screen-reader focus to the new step's heading.
  useEffect(() => {
    if (step === 'newPassword') headingRef.current?.focus();
  }, [step]);

  const mismatch =
    confirmation.length > 0 && confirmation !== newPassword ? 'The passwords do not match.' : '';

  function advance(next: SignInStep) {
    if (next === 'newPasswordRequired') setStep('newPassword');
    else if (next === 'unsupported') {
      setError('This account needs a sign-in step this app does not support yet.');
    }
  }

  async function submit(event: React.FormEvent, action: () => Promise<SignInStep>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      advance(await action());
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
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
          Use the email address your invitation was sent to.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-11 pl-10"
          />
        </div>
      </div>
      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <FormError message={error} />
      <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing in" />
    </form>
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
