'use client';

import type { UpdateUserRequest, UserResponse, UserStatus } from '@cvp/shared';
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
import { formatBytes } from '@/lib/format';

const GIB = 1024 ** 3;
const TRY_AGAIN = 'Check your connection and try again.';

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited, has not signed in yet',
  unconfirmed: 'Has not confirmed their email',
  suspended: 'Suspended',
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export default function UsersPage() {
  const { state } = useAuth();
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
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Only admins can manage users.</p>
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
      report(`An invitation was emailed to ${user.email}.`);
    } catch (caught) {
      report(
        '',
        caught instanceof ApiError && caught.code === 'USER_EXISTS'
          ? 'That email already has an account. Find it in the list below.'
          : caught instanceof ApiError && caught.status === 400
            ? 'Enter a valid email address, like name@example.com.'
            : `The invitation could not be sent. ${TRY_AGAIN}`,
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
      report('', `${user.email} could not be changed. ${TRY_AGAIN}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Users</h1>
        <p className="text-muted-foreground text-sm">
          Everyone with an account. People can also create their own account from the sign-in page.
        </p>
      </div>

      <form
        onSubmit={(submit) => void invite(submit)}
        aria-labelledby="invite-user-title"
        className="grid gap-4 rounded-3xl border px-5 py-5"
      >
        <div className="grid gap-1">
          <h2 id="invite-user-title" className="text-base font-semibold tracking-tight">
            Invite someone
          </h2>
          <p className="text-muted-foreground text-sm">
            They get an email with a temporary password and choose their own at first sign-in.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
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
                placeholder="name@example.com…"
                className="h-9 pl-9"
              />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            <UserPlus aria-hidden />
            Send invitation
          </Button>
        </div>
      </form>

      <section aria-labelledby="users-title" className="grid gap-3">
        <h2 id="users-title" className="text-base font-semibold tracking-tight">
          Accounts{users ? ` (${users.length})` : ''}
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
            The users could not be loaded. Reload the page to try again.
          </p>
        ) : users === null ? (
          <div aria-busy="true" aria-label="Loading users" className="grid gap-3">
            <div className="bg-muted h-24 animate-pulse rounded-3xl motion-reduce:animate-none" />
            <div className="bg-muted h-24 animate-pulse rounded-3xl motion-reduce:animate-none" />
          </div>
        ) : (
          <ul className="bg-card divide-y overflow-hidden rounded-3xl border">
            {users.map((user) => (
              <UserRow key={user.id} user={user} busy={busy} onChange={change} />
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
}: {
  user: UserResponse;
  busy: boolean;
  onChange(user: UserResponse, request: UpdateUserRequest, done: string): Promise<boolean>;
}) {
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
        {user.isSelf && <span className="text-muted-foreground text-sm">(you)</span>}
        <span className="bg-secondary text-secondary-foreground rounded-lg px-2.5 py-1 text-sm">
          {admin ? 'Admin' : 'Member'}
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 text-sm ${
            suspended
              ? 'bg-destructive/10 text-destructive'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {STATUS_LABELS[user.status]}
        </span>
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        Uses {formatBytes(user.bytesUsed)} of {formatBytes(user.quotaBytes)}. Joined{' '}
        <time dateTime={user.createdAt}>{dateFormat.format(new Date(user.createdAt))}</time>.
      </p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (!validQuota || parsed === savedGb) return;
            void onChange(
              user,
              { quotaGb: parsed },
              `${user.email} can now store up to ${parsed} GB.`,
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`quota-${user.id}`}>Storage limit (GB)</Label>
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
            aria-label={`Save storage limit of ${user.email}`}
          >
            Save limit
          </Button>
        </form>
        {/* Admins cannot lock themselves out, so these are not offered on their own row. */}
        {!user.isSelf && (
          <div className="flex flex-wrap gap-2">
            <ConfirmChange
              label={admin ? 'Remove admin' : 'Make admin'}
              ariaLabel={`${admin ? 'Remove admin role from' : 'Make admin:'} ${user.email}`}
              title={admin ? 'Remove the admin role?' : 'Make this person an admin?'}
              description={
                admin
                  ? `${user.email} will no longer review videos or manage users. It can take up to an hour to apply.`
                  : `${user.email} will be able to watch every uploaded video to review it, delete any video, and manage users, including you. It can take up to an hour to apply.`
              }
              confirm={admin ? 'Remove admin' : 'Make admin'}
              disabled={busy}
              onConfirm={() =>
                void onChange(
                  user,
                  { role: admin ? 'user' : 'admin' },
                  admin ? `${user.email} is no longer an admin.` : `${user.email} is now an admin.`,
                )
              }
            />
            <ConfirmChange
              label={suspended ? 'Reactivate' : 'Suspend'}
              ariaLabel={`${suspended ? 'Reactivate' : 'Suspend'} ${user.email}`}
              title={suspended ? 'Reactivate this account?' : 'Suspend this account?'}
              description={
                suspended
                  ? `${user.email} will be able to sign in again.`
                  : `${user.email} will not be able to sign in. Their videos stay. If they are signed in now, it can take up to an hour before they lose access.`
              }
              confirm={suspended ? 'Reactivate' : 'Suspend account'}
              destructive={!suspended}
              disabled={busy}
              onConfirm={() =>
                void onChange(
                  user,
                  { suspended: !suspended },
                  suspended ? `${user.email} can sign in again.` : `${user.email} is suspended.`,
                )
              }
            />
          </div>
        )}
      </div>
      {!validQuota && (
        <p id={`quota-${user.id}-error`} role="alert" className="text-destructive text-sm">
          Enter a whole number of gigabytes from 1 to 1000.
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
          <AlertDialogCancel>Keep as it is</AlertDialogCancel>
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
