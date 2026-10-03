'use client';

import { UploadPanel } from '@/components/upload/upload-panel';
import { useAuth } from '@/lib/auth/auth-context';

export default function LibraryPage() {
  const { state } = useAuth();
  // The app shell only renders this page for a signed-in user.
  if (state.status !== 'signedIn') return null;

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your library</h1>
      <UploadPanel userId={state.user.id} />
    </div>
  );
}
