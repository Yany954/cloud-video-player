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
  const { event, inviteToken, collaborators } = detail;
  const [copied, setCopied] = useState(false);

  if (!event.isOwner) {
    const userId = state.status === 'signedIn' ? state.user.id : '';
    return (
      <section aria-labelledby="invite-title" className="grid gap-3 rounded-3xl border px-5 py-5">
        <h2 id="invite-title" className="text-base font-semibold tracking-tight">
          You were invited to this event
        </h2>
        <p className="text-muted-foreground text-sm">
          You can watch its approved videos and add your own recordings.
        </p>
        <div>
          <Confirm
            trigger={
              <Button variant="outline" disabled={busy}>
                <LogOut aria-hidden />
                Leave event
              </Button>
            }
            title="Leave this event?"
            description="You will no longer see this event or other people’s videos in it. Videos you added stay in the event: remove them first if you do not want that."
            cancel="Stay"
            confirm="Leave event"
            onConfirm={() =>
              void uploadApi
                .removeCollaborator(event.id, userId)
                .then(onLeft, () =>
                  run(
                    () => Promise.reject(new Error('leave failed')),
                    '',
                    'You could not leave the event.',
                  ),
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
          Invite people
        </h2>
        <p className="text-muted-foreground text-sm">
          Anyone who opens the link and signs in can watch this event’s approved videos and add
          their own recordings. Send it only to people you trust.
        </p>
      </div>

      {inviteToken ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="invite-link">Invite link</Label>
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
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p role="status" className="sr-only">
            {copied ? 'Invite link copied.' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Confirm
              trigger={
                <Button variant="outline" disabled={busy}>
                  Make a new link
                </Button>
              }
              title="Make a new invite link?"
              description="The current link stops working at once. People who already joined stay in the event."
              cancel="Keep current link"
              confirm="Make new link"
              onConfirm={() =>
                void run(
                  () => uploadApi.openInvite(event.id),
                  'A new invite link is ready. The old one no longer works.',
                  'A new link could not be made.',
                )
              }
            />
            <Confirm
              trigger={
                <Button variant="outline" disabled={busy}>
                  Turn link off
                </Button>
              }
              title="Turn the invite link off?"
              description="Nobody else will be able to join with it. People who already joined stay in the event."
              cancel="Keep link on"
              confirm="Turn link off"
              onConfirm={() =>
                void run(
                  () => uploadApi.closeInvite(event.id),
                  'The invite link is off.',
                  'The link could not be turned off.',
                )
              }
            />
          </div>
        </div>
      ) : (
        <div>
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () => uploadApi.openInvite(event.id),
                'The invite link is ready to copy.',
                'The invite link could not be made.',
              )
            }
          >
            <Link2 aria-hidden />
            Create invite link
          </Button>
        </div>
      )}

      <div className="grid gap-2">
        <h3 className="text-sm font-medium">
          {collaborators.length === 0 ? 'Nobody has joined yet' : 'People who joined'}
        </h3>
        {collaborators.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {collaborators.map((person) => {
              const name = person.email ?? 'A deleted account';
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
                        aria-label={`Remove ${name} from this event`}
                        className="text-muted-foreground"
                      >
                        <UserMinus aria-hidden />
                      </Button>
                    }
                    title="Remove this person?"
                    description={`${name} will no longer see this event. Videos they added stay in the event. If the invite link is still on, they can join again with it: make a new link to prevent that.`}
                    cancel="Keep in event"
                    confirm="Remove person"
                    onConfirm={() =>
                      void run(
                        () => uploadApi.removeCollaborator(event.id, person.userId),
                        `${name} was removed from the event.`,
                        `${name} could not be removed.`,
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
