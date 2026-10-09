'use client';

import { createContext, useContext } from 'react';
import { useUploads } from './use-uploads';

type Uploads = ReturnType<typeof useUploads>;

const UploadsContext = createContext<Uploads | null>(null);

/**
 * Keeps uploads alive above the pages: moving from "Your videos" to an event or a player does
 * not stop or hide them. They still end when the tab is closed or the person signs out; a
 * stopped upload resumes when the same file is chosen again.
 */
export function UploadsProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return <UploadsContext.Provider value={useUploads(userId)}>{children}</UploadsContext.Provider>;
}

export function useSharedUploads(): Uploads {
  const uploads = useContext(UploadsContext);
  if (!uploads) throw new Error('useSharedUploads must be used inside <UploadsProvider>');
  return uploads;
}
