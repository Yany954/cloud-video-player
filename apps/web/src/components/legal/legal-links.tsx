import Link from 'next/link';
import type { Messages } from '@/lib/i18n/messages/en';

export const LEGAL_PAGES = [
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
  { href: '/cookies', key: 'cookies' },
] as const;

/** The three legal pages, as a small list of links for footers. */
export function LegalLinks({ t, className }: { t: Messages['legal']; className?: string }) {
  return (
    <nav aria-label={t.navLabel} className={className}>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {LEGAL_PAGES.map(({ href, key }) => (
          <li key={href}>
            <Link
              href={href}
              className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3"
            >
              {t[key]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
