'use client';

import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Dropzone({ onFiles }: { onFiles(files: File[]): void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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
        <p className="font-medium">Drop videos here</p>
        <p className="text-muted-foreground text-sm">
          MP4, MOV, MKV or AVI. They are stored in their original quality.
        </p>
      </div>
      {/* The button is the keyboard and screen-reader path; dragging is a shortcut. */}
      <Button size="lg" onClick={() => input.current?.click()}>
        Choose videos
      </Button>
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
