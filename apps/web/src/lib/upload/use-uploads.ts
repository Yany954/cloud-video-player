'use client';

import { ApiError, uploadVideo } from '@cvp/upload-client';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { uploadApi } from '@/lib/api';
import { hasAcceptedExtension, uploadErrorMessage } from './messages';
import { putPartFromBrowser } from './put-part';
import { fingerprint, resumeStore } from './resume-store';
import { useI18n } from '@/lib/i18n/i18n-context';

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
  file: File;
  key: string;
  videoId?: string;
  /** The event a new upload goes into. */
  eventId?: string;
  controller?: AbortController;
}

export function useUploads(userId: string, onUploaded: () => void) {
  const [items, dispatch] = useReducer(reducer, []);
  const jobs = useRef(new Map<string, Job>());
  // The latest texts, read when an error happens, without restarting uploads on a language change.
  const { t } = useI18n();
  const errors = useRef(t.upload.errors);
  useEffect(() => {
    errors.current = t.upload.errors;
  }, [t]);

  const run = useCallback(
    (id: string) => {
      const job = jobs.current.get(id);
      if (!job) return;
      const controller = new AbortController();
      job.controller = controller;
      dispatch({ type: 'update', id, changes: { status: 'uploading', error: undefined } });

      const upload = () =>
        uploadVideo({
          api: uploadApi,
          putPart: putPartFromBrowser,
          source: job.file,
          fileName: job.file.name,
          sizeBytes: job.file.size,
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
              changes: { status: 'done', uploadedBytes: job.file.size, savedBytes: job.file.size },
            });
            onUploaded();
          },
          (error: unknown) => {
            // Paused or cancelled by the user: the action that aborted already set the state.
            if (controller.signal.aborted) return;
            dispatch({
              type: 'update',
              id,
              changes: { status: 'error', error: uploadErrorMessage(error, errors.current) },
            });
          },
        );
    },
    [onUploaded],
  );

  const add = useCallback(
    (files: File[], eventId?: string) => {
      for (const file of files) {
        const id = crypto.randomUUID();
        const item: UploadItem = {
          id,
          fileName: file.name,
          sizeBytes: file.size,
          uploadedBytes: 0,
          savedBytes: 0,
          status: 'uploading',
          canResume: true,
        };
        if (!hasAcceptedExtension(file.name)) {
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
        const key = fingerprint(userId, file);
        jobs.current.set(id, { file, key, videoId: resumeStore.get(key), eventId });
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

  // Warn before closing the tab in the middle of an upload.
  const uploading = items.some((item) => item.status === 'uploading');
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  return { items, add, pause, resume: run, cancel, dismiss };
}
