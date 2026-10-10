import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createContext, use, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '@/i18n/i18n';
import { askToNotify, notifyUploadsFinished } from './notify';
import { clearLeftoverParts } from './put-part';
import { useUploads } from './use-uploads';

type Uploads = ReturnType<typeof useUploads>;

const UploadsContext = createContext<Uploads | null>(null);
const KEEP_AWAKE = 'cvp-uploading';

/**
 * Keeps uploads alive above the screens: moving between tabs, into an event or a player does
 * not stop or hide them. While anything is being sent the screen is kept awake, and when the
 * queue has emptied while the app was not in front, the phone says so with a notification.
 */
export function UploadsProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const uploads = useUploads(userId);
  const { t } = useI18n();

  useEffect(() => {
    clearLeftoverParts();
  }, []);

  const sending = uploads.items.some((item) => item.status === 'uploading');
  useEffect(() => {
    if (!sending) return;
    void activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
    return () => void deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
  }, [sending]);

  const waiting = uploads.items.some(
    (item) => item.status === 'queued' || item.status === 'uploading',
  );
  // The first video in the queue is the moment the question makes sense.
  const asked = useRef(false);
  useEffect(() => {
    if (!waiting || asked.current) return;
    asked.current = true;
    void askToNotify();
  }, [waiting]);

  // The queue has emptied: say how it went, if the person is somewhere else.
  const finishedBefore = useRef(0);
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (wasWaiting.current && !waiting) {
      const finished = uploads.finishedCount - finishedBefore.current;
      const failed = uploads.items.filter((item) => item.status === 'error').length;
      finishedBefore.current = uploads.finishedCount;
      if (AppState.currentState !== 'active' && (finished > 0 || failed > 0)) {
        void notifyUploadsFinished(
          t.uploadNotice.title,
          failed > 0 ? t.uploadNotice.someFailed(finished, failed) : t.uploadNotice.done(finished),
        );
      }
    }
    wasWaiting.current = waiting;
  }, [waiting, uploads.finishedCount, uploads.items, t]);

  return <UploadsContext value={uploads}>{children}</UploadsContext>;
}

export function useSharedUploads(): Uploads {
  const uploads = use(UploadsContext);
  if (!uploads) throw new Error('useSharedUploads must be used inside <UploadsProvider>');
  return uploads;
}
