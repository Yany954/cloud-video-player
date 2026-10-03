'use client';

import type { EventDetailResponse, VideoResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { ArrowLeft, ArrowUp, ArrowUpDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ReorderList } from '@/components/event/reorder-list';
import { selectClassName, VisibilityBadge } from '@/components/event/visibility-badge';
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
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { moveUp, sameOrder } from '@/lib/event/order';

const TRY_AGAIN = 'Check your connection and try again.';

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** The order being arranged in the reorder view; null outside it. */
  const [draft, setDraft] = useState<VideoResponse[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(
    () =>
      uploadApi
        .getEvent(eventId)
        .then(setDetail, (caught: unknown) =>
          setLoadError(
            caught instanceof ApiError && caught.status === 404
              ? 'This event does not exist, or it is private.'
              : `The event could not be loaded. ${TRY_AGAIN}`,
          ),
        ),
    [eventId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one change, then reloads. `done` is announced; a failure shows `failed`. */
  async function run(action: () => Promise<unknown>, done: string, failed: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await load();
      setNotice(done);
      return true;
    } catch {
      setError(`${failed} ${TRY_AGAIN}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link
      href="/events"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-fit items-center gap-1.5 rounded-lg text-sm outline-none focus-visible:ring-3"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Events
    </Link>
  );

  if (loadError) {
    return (
      <div className="grid gap-6">
        {back}
        <p role="alert" className="text-destructive">
          {loadError}
        </p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Loading event">
        {back}
        <div className="bg-muted h-8 w-72 animate-pulse rounded-lg motion-reduce:animate-none" />
        <div className="bg-muted h-40 animate-pulse rounded-3xl motion-reduce:animate-none" />
      </div>
    );
  }

  const { event, videos, myVideoIds } = detail;
  const isPrivate = event.visibility === 'private';
  const ids = videos.map((video) => video.id);

  async function saveOrder(ordered: VideoResponse[], done: string) {
    // Show the new order at once; `run` reloads the saved one, or the old one on failure.
    setDetail({ event, videos: ordered, myVideoIds });
    const saved = await run(
      () =>
        uploadApi.reorderEvent(
          eventId,
          ordered.map((video) => video.id),
        ),
      done,
      'The new order could not be saved.',
    );
    if (!saved) await load();
    return saved;
  }

  return (
    <div className="grid gap-8">
      {back}

      <div className="grid gap-3">
        {renaming === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance break-words">
              {event.name}
            </h1>
            <VisibilityBadge visibility={event.visibility} />
          </div>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(submit) => {
              submit.preventDefault();
              if (renaming.trim().length === 0) return;
              void run(
                () => uploadApi.updateEvent(eventId, { name: renaming }),
                'The event was renamed.',
                'The event could not be renamed.',
              ).then((saved) => saved && setRenaming(null));
            }}
          >
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="rename-event">Event name</Label>
              <Input
                id="rename-event"
                name="rename-event"
                // The user just asked for this field; without it, focus is lost with the button.
                autoFocus
                autoComplete="off"
                maxLength={120}
                required
                value={renaming}
                onChange={(change) => setRenaming(change.target.value)}
                className="h-9"
              />
            </div>
            <Button type="submit" size="lg" disabled={busy}>
              Save name
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
          </form>
        )}

        {event.isOwner && renaming === null && draft === null && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRenaming(event.name)}>
              <Pencil aria-hidden />
              Rename
            </Button>
            {videos.length > 1 && (
              <Button variant="outline" onClick={() => setDraft(videos)}>
                <ArrowUpDown aria-hidden />
                Reorder
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  {isPrivate ? 'Share with everyone' : 'Make private'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isPrivate ? 'Share this event with everyone?' : 'Make this event private?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isPrivate
                      ? 'Everyone in the group will see this event, and its approved videos will appear in the Library.'
                      : 'Only you and the people you invite will see this event. Its videos will leave the Library.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep as it is</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      void run(
                        () =>
                          uploadApi.updateEvent(eventId, {
                            visibility: isPrivate ? 'shared' : 'private',
                          }),
                        isPrivate
                          ? 'The event is now shared with everyone.'
                          : 'The event is now private.',
                        'The event could not be changed.',
                      )
                    }
                  >
                    {isPrivate ? 'Share event' : 'Make private'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 aria-hidden />
                  Delete event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {videos.length > 0 ? 'Take its videos out first' : 'Delete this event?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {videos.length > 0
                      ? 'An event can be deleted only when it is empty. Remove each video from the event, then delete it. The videos themselves are kept.'
                      : `“${event.name}” will be deleted. You cannot undo this.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {videos.length > 0 ? 'Close' : 'Keep event'}
                  </AlertDialogCancel>
                  {videos.length === 0 && (
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        setBusy(true);
                        uploadApi.deleteEvent(eventId).then(
                          () => router.replace('/events'),
                          (caught: unknown) => {
                            setBusy(false);
                            setError(
                              caught instanceof ApiError && caught.status === 409
                                ? 'This event still holds videos from other people, so it cannot be deleted yet.'
                                : `The event could not be deleted. ${TRY_AGAIN}`,
                            );
                          },
                        );
                      }}
                    >
                      Delete event
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {/* Always rendered, never display:none, so screen readers announce each change. */}
        <p role="status" className="text-sm empty:sr-only">
          {notice}
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        {draft !== null ? (
          <section aria-labelledby="reorder-title" className="grid gap-3">
            <div className="grid gap-1">
              <h2 id="reorder-title" className="text-base font-semibold tracking-tight">
                Reorder videos
              </h2>
              <p className="text-muted-foreground text-sm">
                Drag a video by its handle, or use its arrows. Nothing changes until you save.
              </p>
            </div>
            <ReorderList videos={draft} onChange={setDraft} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                disabled={busy}
                onClick={() => {
                  if (
                    sameOrder(
                      draft.map((video) => video.id),
                      ids,
                    )
                  )
                    return setDraft(null);
                  void saveOrder(draft, 'The new order was saved.').then(
                    (saved) => saved && setDraft(null),
                  );
                }}
              >
                {busy ? 'Saving…' : 'Save order'}
              </Button>
              <Button size="lg" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <VideoList
            id="event-videos-title"
            title="Videos, in playing order"
            videos={videos}
            failed={false}
            errorText=""
            empty={{
              title: 'No videos in this event yet',
              text: event.isMember
                ? 'Add your videos below.'
                : 'Its videos will be listed here once they are approved.',
            }}
            from={`event-${event.id}`}
            showStatus
            renderActions={(video) => {
              const index = ids.indexOf(video.id);
              const mine = myVideoIds.includes(video.id);
              return (
                <>
                  {event.isOwner && index > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      disabled={busy}
                      aria-label={`Move ${video.title} one place earlier`}
                      className="text-muted-foreground"
                      onClick={() =>
                        void saveOrder(moveUp(videos, index), `“${video.title}” moved up.`)
                      }
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                  )}
                  {mine && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          disabled={busy}
                          aria-label={`Remove ${video.title} from this event`}
                          className="text-muted-foreground"
                        >
                          <X aria-hidden />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this video from the event?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{video.title}” stays in Your videos; it is not deleted.
                            {isPrivate &&
                              ' Outside this private event, it will appear in the Library for everyone once it is approved.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep in event</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              void run(
                                () => uploadApi.setVideoEvent(video.id, null),
                                `“${video.title}” was removed from the event.`,
                                `“${video.title}” could not be removed.`,
                              )
                            }
                          >
                            Remove from event
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              );
            }}
          />
        )}
      </div>

      {event.isMember && draft === null && (
        <AddVideos
          eventId={event.id}
          busy={busy}
          onAdd={(video) =>
            run(
              () => uploadApi.setVideoEvent(video.id, event.id),
              `“${video.title}” was added to the event.`,
              `“${video.title}” could not be added.`,
            )
          }
        />
      )}
    </div>
  );
}

/** The caller's own videos that are not in this event yet. */
function AddVideos({
  eventId,
  busy,
  onAdd,
}: {
  eventId: string;
  busy: boolean;
  onAdd(video: VideoResponse): Promise<boolean>;
}) {
  const [candidates, setCandidates] = useState<VideoResponse[] | null>(null);
  const [selected, setSelected] = useState('');

  const load = useCallback(
    () =>
      uploadApi.listVideos().then(
        ({ videos }) =>
          setCandidates(
            videos.filter(
              (video) =>
                // Videos still uploading or being prepared cannot be moved yet.
                (video.uploadStatus === 'ready' || video.uploadStatus === 'failed') &&
                video.eventId !== eventId,
            ),
          ),
        () => setCandidates([]),
      ),
    [eventId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const chosen = candidates?.find((video) => video.id === selected);

  return (
    <section aria-labelledby="add-videos-title" className="grid gap-3 rounded-3xl border px-5 py-5">
      <h2 id="add-videos-title" className="text-base font-semibold tracking-tight">
        Add your videos
      </h2>
      {candidates === null ? (
        <div className="bg-muted h-9 animate-pulse rounded-lg motion-reduce:animate-none" />
      ) : candidates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          All of your finished videos are already here. Upload more from Your videos.
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (!chosen) return;
            void onAdd(chosen).then((added) => {
              if (!added) return;
              setSelected('');
              void load();
            });
          }}
        >
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="add-video">Video</Label>
            <select
              id="add-video"
              name="add-video"
              value={selected}
              onChange={(change) => setSelected(change.target.value)}
              className={`${selectClassName} w-full`}
            >
              <option value="">Choose one of your videos…</option>
              {candidates.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                  {video.eventId ? ' (moves from another event)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="lg" disabled={busy || !chosen}>
            <Plus aria-hidden />
            Add to event
          </Button>
        </form>
      )}
    </section>
  );
}
