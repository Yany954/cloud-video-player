import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createContext, use, useEffect, useState } from 'react';
import { clearLeftoverParts } from './put-part';
import { resumeStore } from './resume-store';
import { useUploads } from './use-uploads';

/** `ready` turns true once unfinished uploads from an earlier run can be matched. */
type Uploads = ReturnType<typeof useUploads> & { ready: boolean };

const UploadsContext = createContext<Uploads | null>(null);
const KEEP_AWAKE = 'cvp-uploading';

/**
 * Keeps uploads alive above the screens: moving between tabs, into an event or a player does
 * not stop or hide them. In this version they still stop when the app is closed or the phone
 * locks, so the screen is kept awake while anything is being sent.
 */
export function UploadsProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const uploads = useUploads(userId);
  // Unfinished uploads from an earlier run can only be matched once this has been read.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    clearLeftoverParts();
    void resumeStore.load().finally(() => setReady(true));
  }, []);

  const sending = uploads.items.some((item) => item.status === 'uploading');
  useEffect(() => {
    if (!sending) return;
    void activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
    return () => void deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
  }, [sending]);

  return <UploadsContext value={{ ...uploads, ready }}>{children}</UploadsContext>;
}

export function useSharedUploads(): Uploads {
  const uploads = use(UploadsContext);
  if (!uploads) throw new Error('useSharedUploads must be used inside <UploadsProvider>');
  return uploads;
}
