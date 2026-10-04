'use client';

import type { EventResponse, StorageUsageResponse, VideoResponse } from '@cvp/shared';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DeleteVideoButton } from '@/components/video/delete-video-button';
import { selectClassName } from '@/components/event/visibility-badge';
import { StorageWidget } from '@/components/storage/storage-widget';
import { Label } from '@/components/ui/label';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { useUploads } from '@/lib/upload/use-uploads';
import { isBeingPrepared } from '@/lib/video/status';
import { Dropzone } from './dropzone';
import { UploadList } from './upload-list';
import { useI18n } from '@/lib/i18n/i18n-context';

export function UploadPanel({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [videosFailed, setVideosFailed] = useState(false);
  /** Events the user may add videos to: their own and the ones they were invited to. */
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [eventId, setEventId] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Runs on load and again after every finished upload.
  const refresh = useCallback(() => {
    uploadApi.getStorageUsage().then(setUsage, () => {});
    uploadApi.listVideos().then(
      (response) => {
        setVideos(response.videos);
        setVideosFailed(false);
      },
      () => setVideosFailed(true),
    );
  }, []);
  useEffect(refresh, [refresh]);

  useEffect(() => {
    let active = true;
    uploadApi.listEvents().then(
      ({ mine, invited }) => active && setEvents([...mine, ...invited]),
      // Uploading without an event still works.
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);

  // A video being prepared changes on the server without us doing anything: keep checking.
  const preparing = videos?.some(isBeingPrepared) ?? false;
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [preparing, refresh]);

  const uploads = useUploads(userId, refresh);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="grid gap-8">
        <div className="grid gap-3">
          {events.length > 0 && (
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor="upload-event">{t.upload.eventLabel}</Label>
              <select
                id="upload-event"
                name="upload-event"
                value={eventId}
                onChange={(change) => setEventId(change.target.value)}
                className={selectClassName}
              >
                <option value="">{t.upload.noEvent}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Dropzone onFiles={(files) => uploads.add(files, eventId || undefined)} />
          <p className="text-muted-foreground flex gap-2 text-sm leading-relaxed">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {t.upload.reviewNote}{' '}
              <Link
                href="/terms"
                className="text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3"
              >
                {t.upload.reviewRules}
              </Link>
              .
            </span>
          </p>
        </div>
        <UploadList
          items={uploads.items}
          onPause={uploads.pause}
          onResume={uploads.resume}
          onCancel={uploads.cancel}
          onDismiss={uploads.dismiss}
        />
        <div className="grid gap-3 empty:hidden">
          {/* Always rendered, never display:none, so screen readers announce each change. */}
          <p role="status" className="text-sm empty:sr-only">
            {notice}
          </p>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
        </div>
        <VideoList
          id="my-videos-title"
          title={t.videos.myVideos}
          videos={videos}
          failed={videosFailed}
          errorText={t.videos.loadError}
          empty={{ title: t.videos.emptyTitle, text: t.videos.emptyText }}
          showStatus
          renderActions={(video) =>
            // Not while it is still uploading or being prepared: those are still changing.
            (video.uploadStatus === 'ready' || video.uploadStatus === 'failed') && (
              <DeleteVideoButton
                video={video}
                iconOnly
                onDeleted={() => {
                  setDeleteError('');
                  setNotice(t.videos.deleted(video.title));
                  setVideos((current) => current?.filter((item) => item.id !== video.id) ?? null);
                  refresh();
                }}
                onError={(message) => {
                  setNotice('');
                  setDeleteError(message);
                }}
              />
            )
          }
        />
      </div>
      <StorageWidget usage={usage} />
    </div>
  );
}
