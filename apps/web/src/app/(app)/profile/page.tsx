'use client';

import type { BlockResponse, StorageUsageResponse } from '@cvp/shared';
import { useEffect, useState } from 'react';
import { ApiError } from '@cvp/upload-client';
import { PasswordField } from '@/components/auth/password-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ThemeChoiceGroup } from '@/components/theme-control';
import { StorageWidget } from '@/components/storage/storage-widget';
import { Button } from '@/components/ui/button';
import { uploadApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { changePassword } from '@/lib/auth/cognito';
import { authErrorMessage } from '@/lib/auth/errors';

const MIN_PASSWORD_LENGTH = 12;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export default function ProfilePage() {
  const { state, signOut } = useAuth();
  const [blocks, setBlocks] = useState<BlockResponse[] | null>(null);
  const [blockNotice, setBlockNotice] = useState('');
  const [blockError, setBlockError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
    uploadApi.listBlocks().then(
      (loaded) => active && setBlocks(loaded.blocks),
      () => active && setBlocks([]),
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

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      await uploadApi.deleteMyAccount(deletePassword);
      // The account is already closed on the server; this clears the browser's session.
      await signOut().catch(() => {});
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : 0;
      setDeleteError(
        status === 403
          ? 'Your password is not right.'
          : status === 409
            ? 'You are the only admin. Make someone else an admin first, on the Users page.'
            : 'Your account could not be deleted. Check your connection and try again.',
      );
      setDeleting(false);
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

          <section
            aria-labelledby="appearance-title"
            className="grid gap-3 rounded-3xl border px-5 py-5"
          >
            <h2 id="appearance-title" className="text-base font-semibold tracking-tight">
              Appearance
            </h2>
            <ThemeChoiceGroup />
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

          {blocks !== null && blocks.length > 0 && (
            <section
              aria-labelledby="blocked-title"
              className="grid gap-3 rounded-3xl border px-5 py-5"
            >
              <div className="grid gap-1">
                <h2 id="blocked-title" className="text-base font-semibold tracking-tight">
                  People you blocked
                </h2>
                <p className="text-muted-foreground text-sm">
                  You do not see their videos. The app shows no names, so each person is listed by
                  the video you blocked them from.
                </p>
              </div>
              <ul className="divide-y rounded-lg border">
                {blocks.map((block) => (
                  <li key={block.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm">
                      The person who uploaded{' '}
                      <span className="font-medium break-words">“{block.videoTitle}”</span>
                      <span className="text-muted-foreground">
                        , blocked on{' '}
                        <time dateTime={block.createdAt}>
                          {dateFormat.format(new Date(block.createdAt))}
                        </time>
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      aria-label={`Unblock the person who uploaded ${block.videoTitle}`}
                      onClick={() => {
                        setBlockError('');
                        uploadApi.unblock(block.id).then(
                          () => {
                            setBlocks(
                              (current) => current?.filter((b) => b.id !== block.id) ?? null,
                            );
                            setBlockNotice('Unblocked. You will see their videos again.');
                          },
                          () =>
                            setBlockError(
                              'The person could not be unblocked. Check your connection and try again.',
                            ),
                        );
                      }}
                    >
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
              {blockError && (
                <p role="alert" className="text-destructive text-sm">
                  {blockError}
                </p>
              )}
            </section>
          )}
          {/* Outside the section, which disappears with its last entry. */}
          <p role="status" className="text-sm empty:sr-only">
            {blockNotice}
          </p>

          <section
            aria-labelledby="delete-account-title"
            className="grid gap-4 rounded-3xl border px-5 py-5"
          >
            <div className="grid gap-1">
              <h2 id="delete-account-title" className="text-base font-semibold tracking-tight">
                Delete your account
              </h2>
              <p className="text-muted-foreground text-sm">
                This deletes all your videos and the events you created, and takes you out of the
                events you were invited to. You cannot undo it.
              </p>
            </div>
            <div className="max-w-sm">
              <PasswordField
                id="delete-password"
                label="Your password, to confirm it is you"
                autoComplete="current-password"
                value={deletePassword}
                onChange={setDeletePassword}
              />
            </div>
            {deleteError && (
              <p role="alert" className="text-destructive text-sm">
                {deleteError}
              </p>
            )}
            <div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="lg"
                    disabled={deleting || deletePassword.length === 0}
                  >
                    {deleting ? 'Deleting…' : 'Delete my account'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account for good?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be signed out now. Your videos and events are deleted and cannot be
                      recovered.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my account</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => void deleteAccount()}>
                      Delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </div>
        <StorageWidget usage={usage} />
      </div>
    </div>
  );
}
