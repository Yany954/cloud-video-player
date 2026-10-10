import { ApiError, uploadVideo } from '@cvp/upload-client';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '@/i18n/i18n';
import { api as uploadApi } from '@/lib/api';
import { hasAcceptedExtension, uploadErrorMessage } from './messages';
import { partsAtOnce, putPartFromPhone } from './put-part';
import { isSameVideo, type QueuedUpload } from './queue';
import { discard, QueueStore } from './queue-store';
import type { UploadSource } from './source';

export interface UploadItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedBytes: number;
  /** Bytes in fully received parts. Pausing discards the rest (uploadedBytes - savedBytes). */
  savedBytes: number;
  /** `queued`: waiting for its turn; videos are sent one at a time, in the order chosen. */
  status: 'queued' | 'uploading' | 'paused' | 'done' | 'error';
  error?: string;
  /** False when retrying can't help, e.g. an unsupported format. */
  canResume: boolean;
  /** The connection dropped: worth trying again by itself when the app comes back. */
  retryOnReturn?: boolean;
  /** The server's upload, once started. Lets the video list recognise its unfinished row. */
  videoId: string | null;
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
      // Oldest first: the list reads in the order the videos will be sent.
      return [...items, action.item];
    case 'update':
      return items.map((item) => (item.id === action.id ? { ...item, ...action.changes } : item));
    case 'remove':
      return items.filter((item) => item.id !== action.id);
  }
}

const toItem = (entry: QueuedUpload): UploadItem => ({
  id: entry.id,
  fileName: entry.fileName,
  sizeBytes: entry.sizeBytes,
  uploadedBytes: 0,
  savedBytes: 0,
  status: 'queued',
  canResume: true,
  videoId: entry.videoId,
  thumbnailUri: entry.thumbnailUri,
  durationSeconds: entry.durationSeconds,
});

/**
 * The upload queue. Videos are sent one at a time, in the order they were chosen, and the
 * queue is kept on the phone: after the app was closed, reloaded or stopped by the system, it
 * carries on from the parts the server already has, without choosing anything again.
 */
export function useUploads(userId: string) {
  const [items, dispatch] = useReducer(reducer, []);
  /** Goes up by one each time an upload finishes, so lists know when to reload. */
  const [finishedCount, setFinishedCount] = useState(0);
  /** The queue of an earlier run has been read: uploads may start. */
  const [ready, setReady] = useState(false);
  /** Videos an earlier run had prepared whose file the system has since cleared. */
  const [lostCount, setLostCount] = useState(0);

  const store = useMemo(() => new QueueStore(userId), [userId]);
  const controllers = useRef(new Map<string, AbortController>());
  /** The video being sent right now; there is never more than one. */
  const active = useRef<string | null>(null);

  // The latest texts, read when an error happens.
  const { t } = useI18n();
  const errors = useRef(t.upload.errors);
  useEffect(() => {
    errors.current = t.upload.errors;
  }, [t]);

  // What an earlier run of the app left to send.
  useEffect(() => {
    let current = true;
    void store.load().then(({ kept, lost }) => {
      if (!current) return;
      for (const entry of kept) dispatch({ type: 'add', item: toItem(entry) });
      // Their server uploads would wait forever: give the space back.
      for (const entry of lost) {
        if (entry.videoId) void uploadApi.abort(entry.videoId).catch(() => {});
      }
      setLostCount(lost.length);
      setReady(true);
    });
    return () => {
      current = false;
    };
  }, [store]);

  const start = useCallback(
    (id: string) => {
      const entry = store.get(id);
      if (!entry) return;
      active.current = id;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      dispatch({ type: 'update', id, changes: { status: 'uploading', error: undefined } });

      const upload = (videoId: string | null) =>
        uploadVideo({
          api: uploadApi,
          putPart: putPartFromPhone,
          // Parts handed to iOS keep being sent after the app leaves the screen.
          concurrency: partsAtOnce(entry.sizeBytes),
          source: entry,
          fileName: entry.fileName,
          sizeBytes: entry.sizeBytes,
          videoId: videoId ?? undefined,
          eventId: entry.eventId ?? undefined,
          signal: controller.signal,
          onStarted(startedId) {
            // Remembered at once: from here on, this video resumes instead of starting over.
            store.setVideoId(id, startedId);
            dispatch({ type: 'update', id, changes: { videoId: startedId } });
          },
          onProgress: ({ uploadedBytes, savedBytes }) =>
            dispatch({ type: 'update', id, changes: { uploadedBytes, savedBytes } }),
        });

      const resuming = entry.videoId !== null;
      upload(entry.videoId)
        .catch((error: unknown) => {
          // The remembered upload no longer exists on the server (expired, or removed from
          // the video list): forget it and send this video from the start.
          const gone = error instanceof ApiError && [404, 409].includes(error.status);
          if (!resuming || !gone || controller.signal.aborted) throw error;
          store.setVideoId(id, null);
          dispatch({ type: 'update', id, changes: { videoId: null } });
          return upload(null);
        })
        .then(
          () => {
            store.remove(id);
            dispatch({
              type: 'update',
              id,
              changes: {
                status: 'done',
                uploadedBytes: entry.sizeBytes,
                savedBytes: entry.sizeBytes,
              },
            });
            setFinishedCount((count) => count + 1);
          },
          (error: unknown) => {
            // Paused or cancelled by the person: the action that aborted already set the state.
            if (controller.signal.aborted) return;
            // The screen shows a plain message; the cause goes to the developer's console.
            if (__DEV__) console.warn('Upload failed:', error);
            dispatch({
              type: 'update',
              id,
              changes: {
                status: 'error',
                error: uploadErrorMessage(error, errors.current),
                retryOnReturn: !(error instanceof ApiError),
              },
            });
          },
        )
        .finally(() => {
          controllers.current.delete(id);
          if (active.current === id) active.current = null;
          // Lets the effect below pick the next video.
          setTurn((turn) => turn + 1);
        });
    },
    [store],
  );

  // One at a time: when nothing is being sent, the oldest waiting video goes next.
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (!ready || active.current !== null) return;
    const next = items.find((item) => item.status === 'queued');
    if (next) start(next.id);
  }, [ready, items, turn, start]);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Back in the app: what stopped because the connection dropped (or the phone was locked)
  // gets another go, without anyone pressing anything.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      for (const item of itemsRef.current) {
        if (item.status === 'error' && item.canResume && item.retryOnReturn) {
          dispatch({
            type: 'update',
            id: item.id,
            changes: { status: 'queued', error: undefined },
          });
        }
      }
    });
    return () => subscription.remove();
  }, []);

  const add = useCallback(
    async (sources: UploadSource[], eventId?: string) => {
      for (const source of sources) {
        if (!hasAcceptedExtension(source.fileName)) {
          discard(source.uri);
          dispatch({
            type: 'add',
            item: {
              ...toItem({
                ...source,
                id: `rejected-${Date.now()}-${Math.random()}`,
                eventId: null,
                videoId: null,
                addedAt: '',
              }),
              status: 'error',
              error: errors.current.unsupportedFormat,
              canResume: false,
            },
          });
          continue;
        }
        // Already waiting or being sent: the second prepared copy is not needed.
        if (store.all().some((entry) => isSameVideo(entry, source))) {
          discard(source.uri);
          if (source.thumbnailUri) discard(source.thumbnailUri);
          continue;
        }
        dispatch({ type: 'add', item: toItem(await store.add(source, eventId ?? null)) });
      }
    },
    [store],
  );

  const pause = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    dispatch({ type: 'update', id, changes: { status: 'paused' } });
  }, []);

  /** Back in line: it is sent when its turn comes. */
  const resume = useCallback((id: string) => {
    dispatch({ type: 'update', id, changes: { status: 'queued', error: undefined } });
  }, []);

  /** Stops the upload and discards what was sent, on the server and on the phone. */
  const cancel = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      const videoId = store.get(id)?.videoId;
      if (videoId) void uploadApi.abort(videoId).catch(() => {});
      store.remove(id);
      dispatch({ type: 'remove', id });
    },
    [store],
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'remove', id });
  }, []);

  // Signing out (or the shell going away) stops what is in flight. The queue stays on the
  // phone and carries on at the next sign-in.
  useEffect(() => {
    const running = controllers.current;
    return () => {
      for (const controller of running.values()) controller.abort();
    };
  }, []);

  return { items, finishedCount, ready, lostCount, add, pause, resume, cancel, dismiss };
}
