import { ApiError, uploadVideo } from '@cvp/upload-client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { api as uploadApi } from '@/lib/api';
import { hasAcceptedExtension, uploadErrorMessage } from './messages';
import { putPartFromPhone } from './put-part';
import { resumeStore } from './resume-store';
import { fingerprint, type UploadSource } from './source';
import { useI18n } from '@/i18n/i18n';

export interface UploadItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedBytes: number;
  /** Bytes in fully received parts. Pausing discards the rest (uploadedBytes - savedBytes). */
  savedBytes: number;
  status: 'uploading' | 'paused' | 'done' | 'error';
  error?: string;
  /** False when retrying can't help, e.g. an unsupported format. */
  canResume: boolean;
  /** A small picture and the length, read on the phone when the video was chosen. */
  thumbnailUri: string | null;
  durationSeconds: number | null;
}

type Action =
  | { type: 'add'; item: UploadItem }
  | { type: 'update'; id: string; changes: Partial<UploadItem> }
  | { type: 'remove'; id: string };

function reducer(items: UploadItem[], action: Action): UploadItem[] {
  switch (action.type) {
    case 'add':
      return [action.item, ...items];
    case 'update':
      return items.map((item) => (item.id === action.id ? { ...item, ...action.changes } : item));
    case 'remove':
      return items.filter((item) => item.id !== action.id);
  }
}

/** What an in-flight upload needs but the screen doesn't render. */
interface Job {
  source: UploadSource;
  key: string;
  videoId?: string;
  /** The event a new upload goes into. */
  eventId?: string;
  controller?: AbortController;
}

export function useUploads(userId: string) {
  const [items, dispatch] = useReducer(reducer, []);
  /** Goes up by one each time an upload finishes, so lists know when to reload. */
  const [finishedCount, setFinishedCount] = useState(0);
  const jobs = useRef(new Map<string, Job>());
  // The latest texts, read when an error happens, without restarting uploads on a language change.
  const { t } = useI18n();
  const errors = useRef(t.upload.errors);
  useEffect(() => {
    errors.current = t.upload.errors;
  }, [t]);

  const run = useCallback((id: string) => {
    const job = jobs.current.get(id);
    if (!job) return;
    const controller = new AbortController();
    job.controller = controller;
    dispatch({ type: 'update', id, changes: { status: 'uploading', error: undefined } });

    const upload = () =>
      uploadVideo({
        api: uploadApi,
        putPart: putPartFromPhone,
        // Each part is copied to a temporary file first: two at a time keeps that small.
        concurrency: 2,
        source: job.source,
        fileName: job.source.fileName,
        sizeBytes: job.source.sizeBytes,
        videoId: job.videoId,
        eventId: job.eventId,
        signal: controller.signal,
        onStarted(videoId) {
          job.videoId = videoId;
          resumeStore.set(job.key, videoId);
        },
        onProgress: ({ uploadedBytes, savedBytes }) =>
          dispatch({ type: 'update', id, changes: { uploadedBytes, savedBytes } }),
      });

    const resuming = job.videoId !== undefined;
    upload()
      .catch((error: unknown) => {
        // The remembered upload no longer exists on the server (expired, or finished
        // elsewhere): forget it and send this file from scratch.
        const gone = error instanceof ApiError && [404, 409].includes(error.status);
        if (!resuming || !gone || controller.signal.aborted) throw error;
        resumeStore.delete(job.key);
        job.videoId = undefined;
        return upload();
      })
      .then(
        () => {
          resumeStore.delete(job.key);
          dispatch({
            type: 'update',
            id,
            changes: {
              status: 'done',
              uploadedBytes: job.source.sizeBytes,
              savedBytes: job.source.sizeBytes,
            },
          });
          setFinishedCount((count) => count + 1);
        },
        (error: unknown) => {
          // Paused or cancelled by the user: the action that aborted already set the state.
          if (controller.signal.aborted) return;
          // The screen shows a plain message; the cause goes to the developer's console.
          if (__DEV__) console.warn('Upload failed:', error);
          dispatch({
            type: 'update',
            id,
            changes: { status: 'error', error: uploadErrorMessage(error, errors.current) },
          });
        },
      );
  }, []);

  const add = useCallback(
    (sources: UploadSource[], eventId?: string) => {
      for (const source of sources) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const item: UploadItem = {
          id,
          fileName: source.fileName,
          sizeBytes: source.sizeBytes,
          thumbnailUri: source.thumbnailUri,
          durationSeconds: source.durationSeconds,
          uploadedBytes: 0,
          savedBytes: 0,
          status: 'uploading',
          canResume: true,
        };
        if (!hasAcceptedExtension(source.fileName)) {
          dispatch({
            type: 'add',
            item: {
              ...item,
              status: 'error',
              error: errors.current.unsupportedFormat,
              canResume: false,
            },
          });
          continue;
        }
        const key = fingerprint(userId, source);
        jobs.current.set(id, { source, key, videoId: resumeStore.get(key), eventId });
        dispatch({ type: 'add', item });
        run(id);
      }
    },
    [userId, run],
  );

  const pause = useCallback((id: string) => {
    jobs.current.get(id)?.controller?.abort();
    dispatch({ type: 'update', id, changes: { status: 'paused' } });
  }, []);

  /** Stops the upload and discards what was sent. */
  const cancel = useCallback((id: string) => {
    const job = jobs.current.get(id);
    job?.controller?.abort();
    if (job?.videoId) {
      resumeStore.delete(job.key);
      void uploadApi.abort(job.videoId).catch(() => {});
    }
    jobs.current.delete(id);
    dispatch({ type: 'remove', id });
  }, []);

  const dismiss = useCallback((id: string) => {
    jobs.current.delete(id);
    dispatch({ type: 'remove', id });
  }, []);

  // Signing out (or the shell going away) stops what is in flight. Parts already received
  // stay on the server, so choosing the same file again resumes.
  useEffect(() => {
    const running = jobs.current;
    return () => {
      for (const job of running.values()) job.controller?.abort();
    };
  }, []);

  return { items, finishedCount, add, pause, resume: run, cancel, dismiss };
}
