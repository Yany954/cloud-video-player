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
import { useFormat, useI18n } from '@/lib/i18n/i18n-context';

const MIN_PASSWORD_LENGTH = 12;

export default function ProfilePage() {
  const { state, signOut } = useAuth();
  const { t } = useI18n();
  const fmt = useFormat();
  const p = t.profile;
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
    confirmation.length > 0 && confirmation !== next ? t.auth.passwordsDoNotMatch : '';

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
      setNotice(p.passwordChanged);
    } catch (caught) {
      const name = caught instanceof Error ? caught.name : '';
      setError(
        name === 'NotAuthorizedException'
          ? p.currentPasswordWrong
          : authErrorMessage(caught, t.authErrors),
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
        status === 403 ? p.passwordWrong : status === 409 ? p.onlyAdmin : p.deleteFailed,
      );
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{p.title}</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="grid gap-8">
          <section
            aria-labelledby="account-title"
            className="grid gap-3 rounded-3xl border px-5 py-5"
          >
            <h2 id="account-title" className="text-base font-semibold tracking-tight">
              {p.account}
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">{t.auth.email}</dt>
              <dd className="min-w-0 break-words" translate="no">
                {state.user.email}
              </dd>
              <dt className="text-muted-foreground">{p.role}</dt>
              <dd>{state.user.isAdmin ? p.roleAdmin : p.roleMember}</dd>
            </dl>
          </section>

          <section
            aria-labelledby="appearance-title"
            className="grid gap-3 rounded-3xl border px-5 py-5"
          >
            <h2 id="appearance-title" className="text-base font-semibold tracking-tight">
              {p.appearance}
            </h2>
            <ThemeChoiceGroup />
          </section>

          <form
            onSubmit={(event) => void submit(event)}
            aria-labelledby="password-title"
            className="grid gap-5 rounded-3xl border px-5 py-5"
          >
            <h2 id="password-title" className="text-base font-semibold tracking-tight">
              {p.changePassword}
            </h2>
            <div className="grid max-w-sm gap-5">
              <PasswordField
                id="current-password"
                label={p.currentPassword}
                autoComplete="current-password"
                value={current}
                onChange={setCurrent}
              />
              <PasswordField
                id="new-password"
                label={p.newPassword}
                autoComplete="new-password"
                value={next}
                onChange={setNext}
                minLength={MIN_PASSWORD_LENGTH}
                hint={t.auth.passwordHint(MIN_PASSWORD_LENGTH)}
              />
              <PasswordField
                id="confirm-password"
                label={p.repeatNewPassword}
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
                {pending ? t.common.saving : p.changePassword}
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
                  {p.blockedTitle}
                </h2>
                <p className="text-muted-foreground text-sm">{p.blockedIntro}</p>
              </div>
              <ul className="divide-y rounded-lg border">
                {blocks.map((block) => (
                  <li key={block.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm">
                      {p.blockedPerson}{' '}
                      <span className="font-medium break-words">“{block.videoTitle}”</span>
                      <span className="text-muted-foreground">
                        {p.blockedOn}{' '}
                        <time dateTime={block.createdAt}>{fmt.date(block.createdAt)}</time>
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      aria-label={p.unblockLabel(block.videoTitle)}
                      onClick={() => {
                        setBlockError('');
                        uploadApi.unblock(block.id).then(
                          () => {
                            setBlocks(
                              (current) => current?.filter((b) => b.id !== block.id) ?? null,
                            );
                            setBlockNotice(p.unblocked);
                          },
                          () => setBlockError(p.unblockFailed),
                        );
                      }}
                    >
                      {p.unblock}
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
                {p.deleteTitle}
              </h2>
              <p className="text-muted-foreground text-sm">{p.deleteIntro}</p>
            </div>
            <div className="max-w-sm">
              <PasswordField
                id="delete-password"
                label={p.deletePassword}
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
                    {deleting ? p.deleting : p.deleteButton}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{p.deleteDialogTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{p.deleteDialogText}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{p.keepAccount}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => void deleteAccount()}>
                      {p.deleteButton}
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
