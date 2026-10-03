import { Clapperboard } from 'lucide-react';

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
        <Clapperboard aria-hidden className="size-4" strokeWidth={2} />
      </span>
      <span className="text-base font-semibold tracking-tight">Cloud Video Player</span>
    </span>
  );
}
