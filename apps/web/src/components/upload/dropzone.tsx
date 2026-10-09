'use client';

import { UploadCloud, Video } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/i18n-context';

const TOUCH = '(pointer: coarse)';

/** True on phones and tablets: there, "record" opens the camera instead of a file picker. */
function useTouchDevice(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(TOUCH);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(TOUCH).matches,
    () => false,
  );
}

export function Dropzone({ onFiles }: { onFiles(files: File[]): void }) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const touch = useTouchDevice();
  const [dragging, setDragging] = useState(false);
  const { t } = useI18n();

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles([...event.dataTransfer.files]);
      }}
      className={cn(
        'grid justify-items-center gap-4 rounded-3xl border border-dashed px-6 py-12 text-center transition-colors motion-reduce:transition-none',
        dragging ? 'border-primary bg-primary/5' : 'border-input',
      )}
    >
      <UploadCloud aria-hidden className="text-muted-foreground size-8" strokeWidth={1.5} />
      <div className="grid gap-1">
        <p className="font-medium">{t.upload.dropTitle}</p>
        <p className="text-muted-foreground text-sm">{t.upload.dropHint}</p>
      </div>
      {/* The button is the keyboard and screen-reader path; dragging is a shortcut. */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={() => input.current?.click()}>
          {t.upload.choose}
        </Button>
        {touch && (
          <Button size="lg" variant="outline" onClick={() => camera.current?.click()}>
            <Video aria-hidden />
            {t.upload.record}
          </Button>
        )}
      </div>
      {touch && (
        // `capture` asks the phone for its camera, in video mode, instead of the gallery.
        <input
          ref={camera}
          type="file"
          accept="video/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            onFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept=".mp4,.mov,.mkv,.avi,video/mp4,video/quicktime,video/x-matroska,video/x-msvideo"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          // Lets the same file be picked again, which is how a paused upload is resumed.
          event.target.value = '';
        }}
      />
    </div>
  );
}
