'use client';

import type { EventDetailResponse } from '@cvp/shared';
import { Check, Copy, Link2, LogOut, UserMinus } from 'lucide-react';
import { useState } from 'react';
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
import { useI18n } from '@/lib/i18n/i18n-context';

interface InvitePanelProps {
  detail: EventDetailResponse;
  busy: boolean;
  /** Runs one change and reloads the event; announces `done`, or shows `failed`. */
  run(action: () => Promise<unknown>, done: string, failed: string): Promise<boolean>;
  onLeft(): void;
}

/** The secret travels in the URL fragment, which browsers never send to a server. */
const inviteLink = (eventId: string, token: string) =>
  `${window.location.origin}/events/${eventId}/join#${token}`;

/** For the owner: the invite link and who joined. For a collaborator: a way to leave. */
export function InvitePanel({ detail, busy, run, onLeft }: InvitePanelProps) {
  const { state } = useAuth();
  const i = useI18n().t.invite;
  const { event, inviteToken, collaborators } = detail;
  const [copied, setCopied] = useState(false);

  if (!event.isOwner) {
    const userId = state.status === 'signedIn' ? state.user.id : '';
    return (
      <section aria-labelledby="invite-title" className="grid gap-3 rounded-3xl border px-5 py-5">
        <h2 id="invite-title" className="text-base font-semibold tracking-tight">
          {i.guestTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{i.guestIntro}</p>
        <div>
          <Confirm
            trigger={
              <Button variant="outline" disabled={busy}>
                <LogOut aria-hidden />
                {i.leave}
              </Button>
            }
            title={i.leaveTitle}
            description={i.leaveText}
            cancel={i.stay}
            confirm={i.leave}
            onConfirm={() =>
              void uploadApi
                .removeCollaborator(event.id, userId)
                .then(onLeft, () =>
                  run(() => Promise.reject(new Error('leave failed')), '', i.leaveFailed),
                )
            }
          />
        </div>
      </section>
    );
  }

  const link = inviteToken ? inviteLink(event.id, inviteToken) : '';

  return (
    <section aria-labelledby="invite-title" className="grid gap-4 rounded-3xl border px-5 py-5">
      <div className="grid gap-1">
        <h2 id="invite-title" className="text-base font-semibold tracking-tight">
          {i.title}
        </h2>
        <p className="text-muted-foreground text-sm">{i.intro}</p>
      </div>

      {inviteToken ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="invite-link">{i.link}</Label>
              <Input
                id="invite-link"
                name="invite-link"
                readOnly
                value={link}
                onFocus={(focus) => focus.target.select()}
                className="h-9 font-mono text-xs md:text-xs"
              />
            </div>
            <Button
              size="lg"
              onClick={() =>
                void navigator.clipboard.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                })
              }
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? i.copied : i.copy}
            </Button>
          </div>
          <p role="status" className="sr-only">
            {copied ? i.copiedNotice : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Confirm
              trigger={
                <Button variant="outline" disabled={busy}>
                  {i.newLink}
                </Button>
              }
              title={i.newLinkTitle}
              description={i.newLinkText}
              cancel={i.keepLink}
              confirm={i.newLinkConfirm}
              onConfirm={() =>
                void run(() => uploadApi.openInvite(event.id), i.newLinkReady, i.newLinkFailed)
              }
            />
            <Confirm
              trigger={
                <Button variant="outline" disabled={busy}>
                  {i.turnOff}
                </Button>
              }
              title={i.turnOffTitle}
              description={i.turnOffText}
              cancel={i.keepOn}
              confirm={i.turnOff}
              onConfirm={() =>
                void run(() => uploadApi.closeInvite(event.id), i.turnedOff, i.turnOffFailed)
              }
            />
          </div>
        </div>
      ) : (
        <div>
          <Button
            disabled={busy}
            onClick={() =>
              void run(() => uploadApi.openInvite(event.id), i.created, i.createFailed)
            }
          >
            <Link2 aria-hidden />
            {i.create}
          </Button>
        </div>
      )}

      <div className="grid gap-2">
        <h3 className="text-sm font-medium">{collaborators.length === 0 ? i.nobody : i.joined}</h3>
        {collaborators.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {collaborators.map((person) => {
              const name = person.email ?? i.deletedAccount;
              return (
                <li key={person.userId} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm" title={name} translate="no">
                    {name}
                  </span>
                  <Confirm
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        disabled={busy}
                        aria-label={i.removeLabel(name)}
                        className="text-muted-foreground"
                      >
                        <UserMinus aria-hidden />
                      </Button>
                    }
                    title={i.removeTitle}
                    description={i.removeText(name)}
                    cancel={i.keepPerson}
                    confirm={i.removeConfirm}
                    onConfirm={() =>
                      void run(
                        () => uploadApi.removeCollaborator(event.id, person.userId),
                        i.removed(name),
                        i.removeFailed(name),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Confirm({
  trigger,
  title,
  description,
  cancel,
  confirm,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  cancel: string;
  confirm: string;
  onConfirm(): void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
