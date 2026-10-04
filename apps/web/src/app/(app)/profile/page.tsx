'use client';

import type { StorageUsageResponse } from '@cvp/shared';
import { useEffect, useState } from 'react';
import { PasswordField } from '@/components/auth/password-field';
import { StorageWidget } from '@/components/storage/storage-widget';
import { Button } from '@/components/ui/button';
import { uploadApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { changePassword } from '@/lib/auth/cognito';
import { authErrorMessage } from '@/lib/auth/errors';

const MIN_PASSWORD_LENGTH = 12;

export default function ProfilePage() {
  const { state } = useAuth();
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    uploadApi.getStorageUsage().then(
      (loaded) => active && setUsage(loaded),
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);

  // The app shell only renders this page for a signed-in user.
  if (state.status !== 'signedIn') return null;

  const mismatch =
    confirmation.length > 0 && confirmation !== next ? 'The passwords do not match.' : '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mismatch) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirmation('');
      setNotice('Your password was changed.');
    } catch (caught) {
      const name = caught instanceof Error ? caught.name : '';
      setError(
        name === 'NotAuthorizedException'
          ? 'Your current password is not right.'
          : authErrorMessage(caught),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Your profile</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="grid gap-8">
          <section
            aria-labelledby="account-title"
            className="grid gap-3 rounded-3xl border px-5 py-5"
          >
            <h2 id="account-title" className="text-base font-semibold tracking-tight">
              Account
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="min-w-0 break-words" translate="no">
                {state.user.email}
              </dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                {state.user.isAdmin
                  ? 'Admin: you review videos and manage users'
                  : 'Member: you upload and watch'}
              </dd>
            </dl>
          </section>

          <form
            onSubmit={(event) => void submit(event)}
            aria-labelledby="password-title"
            className="grid gap-5 rounded-3xl border px-5 py-5"
          >
            <h2 id="password-title" className="text-base font-semibold tracking-tight">
              Change password
            </h2>
            <div className="grid max-w-sm gap-5">
              <PasswordField
                id="current-password"
                label="Current password"
                autoComplete="current-password"
                value={current}
                onChange={setCurrent}
              />
              <PasswordField
                id="new-password"
                label="New password"
                autoComplete="new-password"
                value={next}
                onChange={setNext}
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
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            {/* Always rendered, never display:none, so screen readers announce the change. */}
            <p role="status" className="text-sm empty:sr-only">
              {notice}
            </p>
            <div>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? 'Saving…' : 'Change password'}
              </Button>
            </div>
          </form>
        </div>
        <StorageWidget usage={usage} />
      </div>
    </div>
  );
}
