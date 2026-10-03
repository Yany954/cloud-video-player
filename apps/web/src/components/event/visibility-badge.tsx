import type { EventVisibility } from '@cvp/shared';
import { Lock, Users } from 'lucide-react';

/**
 * Text plus an icon, never colour alone. The app only creates private events; "shared" is
 * kept for events made shared through the API.
 */
export function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const Icon = visibility === 'private' ? Lock : Users;
  return (
    <span className="bg-secondary text-secondary-foreground inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm">
      <Icon aria-hidden className="size-3.5" />
      {visibility === 'private' ? 'Private' : 'Visible to all users'}
    </span>
  );
}

export const selectClassName =
  'border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 min-w-0 rounded-lg border px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm';
