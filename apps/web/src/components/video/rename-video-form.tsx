'use client';

import { VIDEO_TITLE_MAX_LENGTH } from '@cvp/shared';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n-context';

interface RenameVideoFormProps {
  video: { id: string; title: string };
  onRenamed(title: string): void;
  onCancel(): void;
}

/** Changes a video's title in place. The file itself, and its file name, are not touched. */
export function RenameVideoForm({ video, onRenamed, onCancel }: RenameVideoFormProps) {
  const { t } = useI18n();
  const r = t.renameVideo;
  const inputId = useId();
  const [title, setTitle] = useState(video.title);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = title.trim();

  return (
    <form
      className="grid gap-2"
      onSubmit={(submit) => {
        submit.preventDefault();
        if (trimmed.length === 0) return;
        if (trimmed === video.title) return onCancel();
        setBusy(true);
        setFailed(false);
        uploadApi.renameVideo(video.id, trimmed).then(
          (renamed) => onRenamed(renamed.title),
          () => {
            setFailed(true);
            setBusy(false);
          },
        );
      }}
    >
      <Label htmlFor={inputId}>{r.label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          name="title"
          autoComplete="off"
          // The user just asked for this field; without it, focus is lost with the button.
          autoFocus
          required
          maxLength={VIDEO_TITLE_MAX_LENGTH}
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          onFocus={(focus) => focus.target.select()}
          aria-describedby={failed ? `${inputId}-error` : undefined}
          className="h-9 min-w-0 flex-1 basis-48"
        />
        <Button type="submit" disabled={busy || trimmed.length === 0}>
          {busy ? t.common.saving : r.save}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
      {failed && (
        <p id={`${inputId}-error`} role="alert" className="text-destructive text-sm">
          {r.failed} {t.common.tryAgain}
        </p>
      )}
    </form>
  );
}
