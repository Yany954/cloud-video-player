import { Film } from 'lucide-react';

export default function LibraryPage() {
  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your library</h1>
      <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed px-6 py-16 text-center">
        <Film aria-hidden className="text-muted-foreground size-8" strokeWidth={1.5} />
        <p className="font-medium">No videos yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Uploading from this page is the next thing being built.
        </p>
      </div>
    </div>
  );
}
