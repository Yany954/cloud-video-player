'use client';

import type { UpdateUserRequest, UserResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { Mail, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { useFormat, useI18n } from '@/lib/i18n/i18n-context';

const GIB = 1024 ** 3;
export default function UsersPage() {
  const { state } = useAuth();
  const { t } = useI18n();
  const u = t.users;
  const isAdmin = state.status === 'signedIn' && state.user.isAdmin;
  const [users, setUsers] = useState<UserResponse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    uploadApi.listUsers().then(
      (response) => active && setUsers(response.users),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [isAdmin]);

  // The server refuses non-admins anyway; this only avoids showing them a broken page.
  if (!isAdmin) {
    return (
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{u.title}</h1>
        <p className="text-muted-foreground">{u.adminsOnly}</p>
      </div>
    );
  }

  function report(done: string, problem = '') {
    setNotice(done);
    setError(problem);
  }

  async function invite(submit: React.FormEvent) {
    submit.preventDefault();
    setBusy(true);
    try {
      const user = await uploadApi.inviteUser(email);
      setUsers((current) => [...(current ?? []), user]);
      setEmail('');
      report(u.invited(user.email));
    } catch (caught) {
      report(
        '',
        caught instanceof ApiError && caught.code === 'USER_EXISTS'
          ? u.alreadyExists
          : caught instanceof ApiError && caught.status === 400
            ? t.authErrors.invalidEmail
            : `${u.inviteFailed} ${t.common.tryAgain}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: UserResponse) {
    setBusy(true);
    try {
      await uploadApi.deleteUser(user.id);
      setUsers((current) => current?.filter((item) => item.id !== user.id) ?? null);
      report(u.deleted(user.email));
    } catch (caught) {
      report(
        '',
        caught instanceof ApiError && caught.status === 409
          ? u.onlyAdmin(user.email)
          : `${u.deleteFailed(user.email)} ${t.common.tryAgain}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function change(user: UserResponse, request: UpdateUserRequest, done: string) {
    setBusy(true);
    try {
      const updated = await uploadApi.updateUser(user.id, request);
      setUsers(
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      report(done);
      return true;
    } catch {
      report('', `${u.changeFailed(user.email)} ${t.common.tryAgain}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{u.title}</h1>
        <p className="text-muted-foreground text-sm">{u.intro}</p>
      </div>

      <form
        onSubmit={(submit) => void invite(submit)}
        aria-labelledby="invite-user-title"
        className="grid gap-4 rounded-3xl border px-5 py-5"
      >
        <div className="grid gap-1">
          <h2 id="invite-user-title" className="text-base font-semibold tracking-tight">
            {u.inviteTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{u.inviteIntro}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="invite-email">{t.auth.email}</Label>
            <div className="relative">
              <Mail
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                id="invite-email"
                name="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                required
                value={email}
                onChange={(input) => setEmail(input.target.value)}
                placeholder={u.emailPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            <UserPlus aria-hidden />
            {u.sendInvitation}
          </Button>
        </div>
      </form>

      <section aria-labelledby="users-title" className="grid gap-3">
        <h2 id="users-title" className="text-base font-semibold tracking-tight">
          {u.accounts(users ? users.length : null)}
        </h2>
        {/* Always rendered, never display:none, so screen readers announce each change. */}
        <p role="status" className="text-sm empty:sr-only">
          {notice}
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {failed ? (
          <p role="alert" className="text-destructive text-sm">
            {u.loadError}
          </p>
        ) : users === null ? (
          <div aria-busy="true" aria-label={u.loading} className="grid gap-3">
            <div className="bg-muted h-24 animate-pulse rounded-3xl motion-reduce:animate-none" />
            <div className="bg-muted h-24 animate-pulse rounded-3xl motion-reduce:animate-none" />
          </div>
        ) : (
          <ul className="bg-card divide-y overflow-hidden rounded-3xl border">
            {users.map((user) => (
              <UserRow key={user.id} user={user} busy={busy} onChange={change} onDelete={remove} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  busy,
  onChange,
  onDelete,
}: {
  user: UserResponse;
  busy: boolean;
  onChange(user: UserResponse, request: UpdateUserRequest, done: string): Promise<boolean>;
  onDelete(user: UserResponse): Promise<void>;
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  const u = t.users;
  const email = user.email;
  const savedGb = Math.round(user.quotaBytes / GIB);
  const [quotaGb, setQuotaGb] = useState(String(savedGb));
  const parsed = Number(quotaGb);
  const validQuota = Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000;
  const suspended = user.status === 'suspended';
  const admin = user.role === 'admin';

  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 truncate font-medium" title={user.email} translate="no">
          {user.email}
        </span>
        {user.isSelf && <span className="text-muted-foreground text-sm">{u.you}</span>}
        <span className="bg-secondary text-secondary-foreground rounded-lg px-2.5 py-1 text-sm">
          {admin ? u.admin : u.member}
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 text-sm ${
            suspended
              ? 'bg-destructive/10 text-destructive'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {u.status[user.status]}
        </span>
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        {u.usage(fmt.bytes(user.bytesUsed), fmt.bytes(user.quotaBytes))}{' '}
        <time dateTime={user.createdAt}>{fmt.date(user.createdAt)}</time>.
      </p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (!validQuota || parsed === savedGb) return;
            void onChange(user, { quotaGb: parsed }, u.quotaSaved(email, parsed));
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`quota-${user.id}`}>{u.quotaLabel}</Label>
            <Input
              id={`quota-${user.id}`}
              name={`quota-${user.id}`}
              type="number"
              inputMode="numeric"
              autoComplete="off"
              min={1}
              max={1000}
              step={1}
              value={quotaGb}
              onChange={(input) => setQuotaGb(input.target.value)}
              aria-invalid={!validQuota || undefined}
              aria-describedby={!validQuota ? `quota-${user.id}-error` : undefined}
              className="h-9 w-28 tabular-nums"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            variant="outline"
            disabled={busy || !validQuota || parsed === savedGb}
            aria-label={u.quotaSaveLabel(email)}
          >
            {u.quotaSave}
          </Button>
        </form>
        {/* Admins cannot lock themselves out, so these are not offered on their own row. */}
        {!user.isSelf && (
          <div className="flex flex-wrap gap-2">
            <ConfirmChange
              label={admin ? u.removeAdmin : u.makeAdmin}
              ariaLabel={admin ? u.removeAdminLabel(email) : u.makeAdminLabel(email)}
              title={admin ? u.removeAdminTitle : u.makeAdminTitle}
              description={admin ? u.removeAdminText(email) : u.makeAdminText(email)}
              confirm={admin ? u.removeAdmin : u.makeAdmin}
              disabled={busy}
              onConfirm={() =>
                void onChange(
                  user,
                  { role: admin ? 'user' : 'admin' },
                  admin ? u.noLongerAdmin(email) : u.nowAdmin(email),
                )
              }
            />
            <ConfirmChange
              label={suspended ? u.reactivate : u.suspend}
              ariaLabel={suspended ? u.reactivateLabel(email) : u.suspendLabel(email)}
              title={suspended ? u.reactivateTitle : u.suspendTitle}
              description={suspended ? u.reactivateText(email) : u.suspendText(email)}
              confirm={suspended ? u.reactivate : u.suspendConfirm}
              destructive={!suspended}
              disabled={busy}
              onConfirm={() =>
                void onChange(
                  user,
                  { suspended: !suspended },
                  suspended ? u.reactivated(email) : u.suspended(email),
                )
              }
            />
            <ConfirmChange
              label={u.delete}
              ariaLabel={u.deleteLabel(email)}
              title={u.deleteTitle}
              description={u.deleteText(email)}
              confirm={u.delete}
              destructive
              disabled={busy}
              onConfirm={() => void onDelete(user)}
            />
          </div>
        )}
      </div>
      {!validQuota && (
        <p id={`quota-${user.id}-error`} role="alert" className="text-destructive text-sm">
          {u.quotaInvalid}
        </p>
      )}
    </li>
  );
}

function ConfirmChange(props: {
  label: string;
  ariaLabel: string;
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
  disabled: boolean;
  onConfirm(): void;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="lg"
          variant={props.destructive ? 'destructive' : 'outline'}
          disabled={props.disabled}
          aria-label={props.ariaLabel}
        >
          {props.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.keepAsItIs}</AlertDialogCancel>
          <AlertDialogAction
            variant={props.destructive ? 'destructive' : 'default'}
            onClick={props.onConfirm}
          >
            {props.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
