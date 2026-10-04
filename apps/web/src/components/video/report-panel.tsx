'use client';

import { REPORT_REASONS, type ReportReason } from '@cvp/shared';
import { EyeOff, Flag } from 'lucide-react';
import { useState } from 'react';
import { selectClassName } from '@/components/event/visibility-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n-context';

const MAX_NOTE_LENGTH = 500;
interface ReportPanelProps {
  video: { id: string; title: string };
  /** Called once the video is hidden from the viewer (reported, or its uploader blocked). */
  onHidden(): void;
}

/** For other people's videos: report it to the admins, or stop seeing its uploader's videos. */
export function ReportPanel({ video, onHidden }: ReportPanelProps) {
  const { t } = useI18n();
  const r = t.report;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function report(submit: React.FormEvent) {
    submit.preventDefault();
    if (reason === '') {
      setError(r.reasonMissing);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await uploadApi.reportVideo(video.id, { reason, note: note.trim() || undefined });
      onHidden();
    } catch {
      setError(`${r.sendFailed} ${t.common.tryAgain}`);
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    setError('');
    try {
      await uploadApi.blockUploader(video.id);
      onHidden();
    } catch {
      setError(`${r.blockFailed} ${t.common.tryAgain}`);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="report-title" className="grid gap-3 rounded-3xl border px-5 py-4">
      <div className="grid gap-1">
        <h2 id="report-title" className="text-base font-semibold tracking-tight">
          {r.title}
        </h2>
        <p className="text-muted-foreground text-sm">{r.intro}</p>
      </div>

      {open ? (
        <form onSubmit={(submit) => void report(submit)} noValidate className="grid gap-4">
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="report-reason">{r.reasonLabel}</Label>
            <select
              id="report-reason"
              name="report-reason"
              // The viewer just asked for this form.
              autoFocus
              value={reason}
              onChange={(change) => setReason(change.target.value as ReportReason | '')}
              aria-invalid={error && reason === '' ? true : undefined}
              className={selectClassName}
            >
              <option value="">{r.reasonChoose}</option>
              {REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {r.reasons[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-note">{r.noteLabel}</Label>
            <textarea
              id="report-note"
              name="report-note"
              rows={3}
              maxLength={MAX_NOTE_LENGTH}
              value={note}
              onChange={(change) => setNote(change.target.value)}
              aria-describedby="report-note-hint"
              className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-w-0 rounded-lg border px-2.5 py-2 text-base outline-none focus-visible:ring-3 md:text-sm"
            />
            <p id="report-note-hint" className="text-muted-foreground text-sm tabular-nums">
              {r.noteHint(note.length, MAX_NOTE_LENGTH)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" variant="destructive" disabled={busy}>
              {busy ? r.sending : r.send}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(true)}>
            <Flag aria-hidden />
            {r.open}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={busy}>
                <EyeOff aria-hidden />
                {r.hide}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{r.hideTitle}</AlertDialogTitle>
                <AlertDialogDescription>{r.hideText(video.title)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{r.keepSeeing}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void block()}>{r.hideConfirm}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
