'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { uploadApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * Saves a copy of the video to this device, to watch without a connection. The link is asked
 * for at the moment of the click, because it only lasts a few minutes.
 */
export function DownloadVideoButton({ video }: { video: { id: string; title: string } }) {
  const { t } = useI18n();
  const d = t.downloadVideo;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const { url } = await uploadApi.getDownload(video.id);
      // The server answers "save this file", so the page (and a playing video) stays put.
      window.location.assign(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div>
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          aria-label={d.label(video.title)}
          onClick={() => void download()}
        >
          <Download aria-hidden />
          {busy ? d.preparing : d.button}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{d.hint}</p>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {d.failed} {t.common.tryAgain}
        </p>
      )}
    </div>
  );
}
