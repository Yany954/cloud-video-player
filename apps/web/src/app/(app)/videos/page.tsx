'use client';

import { UploadPanel } from '@/components/upload/upload-panel';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function HomePage() {
  const { state } = useAuth();
  const { t } = useI18n();
  // The app shell only renders this page for a signed-in user.
  if (state.status !== 'signedIn') return null;

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.videos.pageTitle}</h1>
      <UploadPanel />
    </div>
  );
}
