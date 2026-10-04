'use client';

import type { EventDetailResponse, VideoResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { ArrowLeft, ArrowUp, ArrowUpDown, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { EventHeader } from '@/components/event/event-header';
import { InvitePanel } from '@/components/event/invite-panel';
import { ThemePicker } from '@/components/event/theme-picker';
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
import { isBeingPrepared, videoStatusLabel } from '@/lib/video/status';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const e = t.event;
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
              ? e.notFound
              : `${e.loadFailed} ${t.common.tryAgain}`,
          ),
        ),
    [eventId, e.loadFailed, e.notFound, t.common.tryAgain],
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
      setError(`${failed} ${t.common.tryAgain}`);
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
      {e.back}
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
      <div className="grid gap-6" aria-busy="true" aria-label={e.loading}>
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
    setDetail({ ...detail!, videos: ordered });
    const saved = await run(
      () =>
        uploadApi.reorderEvent(
          eventId,
          ordered.map((video) => video.id),
        ),
      done,
      e.orderNotSaved,
    );
    if (!saved) await load();
    return saved;
  }

  return (
    <div className="grid gap-8">
      {back}

      <div className="grid gap-3">
        {renaming === null ? (
          <EventHeader name={event.name} theme={event.theme}>
            <VisibilityBadge visibility={event.visibility} />
          </EventHeader>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(submit) => {
              submit.preventDefault();
              if (renaming.trim().length === 0) return;
              void run(
                () => uploadApi.updateEvent(eventId, { name: renaming }),
                e.renamed,
                e.renameFailed,
              ).then((saved) => saved && setRenaming(null));
            }}
          >
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="rename-event">{e.nameLabel}</Label>
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
              {e.saveName}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setRenaming(null)}>
              {t.common.cancel}
            </Button>
          </form>
        )}

        {renaming === null && (
          <p className="text-muted-foreground text-sm">
            {!isPrivate ? e.visibleToEveryone : event.isOwner ? e.privateOwner : e.privateGuest}
          </p>
        )}

        {renaming === null && draft === null && videos.some((v) => v.uploadStatus === 'ready') && (
          <div>
            <Button asChild size="lg">
              <Link href={`/events/${event.id}/play`}>
                <Play aria-hidden className="fill-current" />
                {e.playAll}
              </Link>
            </Button>
          </div>
        )}

        {event.isOwner && renaming === null && draft === null && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRenaming(event.name)}>
              <Pencil aria-hidden />
              {e.rename}
            </Button>
            {videos.length > 1 && (
              <Button variant="outline" onClick={() => setDraft(videos)}>
                <ArrowUpDown aria-hidden />
                {e.reorder}
              </Button>
            )}
            {!isPrivate && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={busy}>
                    {e.makePrivate}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{e.makePrivateTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{e.makePrivateText}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.keepAsItIs}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        void run(
                          () => uploadApi.updateEvent(eventId, { visibility: 'private' }),
                          e.nowPrivate,
                          e.changeFailed,
                        )
                      }
                    >
                      {e.makePrivate}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 aria-hidden />
                  {e.delete}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {videos.length > 0 ? e.deleteNotEmptyTitle : e.deleteTitle}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {videos.length > 0 ? e.deleteNotEmptyText : e.deleteText(event.name)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {videos.length > 0 ? t.common.close : e.keep}
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
                                ? e.deleteHasOthersVideos
                                : `${e.deleteFailed} ${t.common.tryAgain}`,
                            );
                          },
                        );
                      }}
                    >
                      {e.delete}
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {event.isOwner && renaming === null && draft === null && (
        <ThemePicker
          value={event.theme}
          disabled={busy}
          onChange={(theme) =>
            void run(
              () => uploadApi.updateEvent(eventId, { theme }),
              e.themeChanged,
              e.changeFailed,
            )
          }
        />
      )}

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
                {e.reorderTitle}
              </h2>
              <p className="text-muted-foreground text-sm">{e.reorderHint}</p>
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
                  void saveOrder(draft, e.orderSaved).then((saved) => saved && setDraft(null));
                }}
              >
                {busy ? t.common.saving : e.saveOrder}
              </Button>
              <Button size="lg" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                {t.common.cancel}
              </Button>
            </div>
          </section>
        ) : (
          <VideoList
            id="event-videos-title"
            title={e.videosTitle}
            videos={videos}
            failed={false}
            errorText=""
            empty={{
              title: e.emptyTitle,
              text: event.isMember ? e.emptyMember : e.emptyVisitor,
            }}
            hrefFor={(video) => `/events/${event.id}/play?v=${video.id}`}
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
                      aria-label={e.moveEarlier(video.title)}
                      className="text-muted-foreground"
                      onClick={() => void saveOrder(moveUp(videos, index), e.movedUp(video.title))}
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
                          aria-label={e.removeLabel(video.title)}
                          className="text-muted-foreground"
                        >
                          <X aria-hidden />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{e.removeTitle}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {e.removeText(video.title)}
                            {isPrivate && e.removePrivateNote}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{e.keepInEvent}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              void run(
                                () => uploadApi.setVideoEvent(video.id, null),
                                e.removed(video.title),
                                e.removeFailed(video.title),
                              )
                            }
                          >
                            {e.remove}
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

      {draft === null && (event.isOwner || event.isMember) && (
        <InvitePanel
          detail={detail}
          busy={busy}
          run={run}
          onLeft={() => router.replace('/events')}
        />
      )}

      {event.isMember && draft === null && (
        <AddVideos
          eventId={event.id}
          busy={busy}
          onAdd={(video) =>
            run(
              () => uploadApi.setVideoEvent(video.id, event.id),
              e.added(video.title),
              e.addFailed(video.title),
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
  const { t } = useI18n();
  const e = t.event;
  const [candidates, setCandidates] = useState<VideoResponse[] | null>(null);
  const [selected, setSelected] = useState('');

  const load = useCallback(
    () =>
      uploadApi.listVideos().then(
        ({ videos }) => setCandidates(videos.filter((video) => video.eventId !== eventId)),
        () => setCandidates((current) => current ?? []),
      ),
    [eventId],
  );
  useEffect(() => {
    void load();
    // A video uploaded in another tab, or approved meanwhile, shows up on coming back.
    const refresh = () => document.visibilityState === 'visible' && void load();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  // A video being prepared becomes addable without the user doing anything: keep checking.
  const preparing = candidates?.some(isBeingPrepared) ?? false;
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [preparing, load]);

  const chosen = candidates?.find((video) => video.id === selected && canMove(video));

  return (
    <section aria-labelledby="add-videos-title" className="grid gap-3 rounded-3xl border px-5 py-5">
      <h2 id="add-videos-title" className="text-base font-semibold tracking-tight">
        {e.addTitle}
      </h2>
      {candidates === null ? (
        <div className="bg-muted h-9 animate-pulse rounded-lg motion-reduce:animate-none" />
      ) : candidates.length === 0 ? (
        <p className="text-muted-foreground text-sm">{e.addNone}</p>
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
            <Label htmlFor="add-video">{e.addVideoLabel}</Label>
            <select
              id="add-video"
              name="add-video"
              value={selected}
              onChange={(change) => setSelected(change.target.value)}
              className={`${selectClassName} w-full`}
            >
              <option value="">{e.addChoose}</option>
              {candidates.map((video) => (
                <option key={video.id} value={video.id} disabled={!canMove(video)}>
                  {video.title}
                  {!canMove(video)
                    ? e.addNotReady(videoStatusLabel(video, t.videoStatus).toLowerCase())
                    : video.eventId
                      ? e.addMoves
                      : ''}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="lg" disabled={busy || !chosen}>
            <Plus aria-hidden />
            {e.add}
          </Button>
        </form>
      )}
    </section>
  );
}

/** A video can change event once it has finished uploading and being prepared. */
function canMove(video: VideoResponse): boolean {
  return video.uploadStatus === 'ready' || video.uploadStatus === 'failed';
}
