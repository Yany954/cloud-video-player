'use client';

import { CircleUser, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Brand } from '@/components/brand';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeToggle } from '@/components/theme-control';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { HOME, rememberReturnTo } from '@/lib/auth/return-to';
import { useI18n } from '@/lib/i18n/i18n-context';

/** Signed-in frame. Sends signed-out visitors to /login. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (state.status !== 'signedOut') return;
    const { pathname, search, hash } = window.location;
    rememberReturnTo(pathname + search + hash);
    router.replace('/login');
  }, [state.status, router]);

  const pathname = usePathname();

  if (state.status !== 'signedIn') return <ShellSkeleton />;

  const links = [
    { href: HOME, label: t.nav.yourVideos },
    { href: '/events', label: t.nav.events },
    { href: '/library', label: t.nav.library },
    // Hidden from everyone else; the server enforces it too.
    ...(state.user.isAdmin
      ? [
          { href: '/review', label: t.nav.review },
          { href: '/users', label: t.nav.users },
        ]
      : []),
  ];

  return (
    <>
      <a
        href="#content"
        className="bg-background text-foreground focus-visible:ring-ring/50 sr-only rounded-lg px-4 py-2 outline-none focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:ring-3"
      >
        {t.common.skipToContent}
      </a>
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={HOME}
            className="focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-3"
          >
            {/* On a phone the header holds five controls: the name gives way to them. */}
            <Brand compact />
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/profile"
              aria-label={t.nav.profileOf(state.user.email)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex h-8 max-w-56 min-w-8 items-center justify-center gap-1.5 rounded-lg px-1 text-sm outline-none focus-visible:ring-3"
            >
              <CircleUser aria-hidden className="size-4 shrink-0" />
              <span className="hidden truncate sm:block" translate="no">
                {state.user.email}
              </span>
            </Link>
            <LanguageSwitch />
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={() => void signOut()}
              // Icon only on a phone; the name is always there for screen readers.
              aria-label={t.nav.signOut}
              className="max-sm:size-8 max-sm:px-0"
            >
              <LogOut aria-hidden />
              <span className="max-sm:hidden">{t.nav.signOut}</span>
            </Button>
          </div>
        </div>
        <nav
          aria-label={t.nav.label}
          className="mx-auto w-full max-w-5xl overflow-x-auto px-4 sm:px-6"
        >
          <ul className="flex gap-1">
            {links.map((link) => {
              // "Your videos" is /videos; a single video (/videos/<id>) is reached from many lists.
              const current =
                pathname === link.href ||
                (link.href !== HOME && pathname.startsWith(`${link.href}/`));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? 'page' : undefined}
                    className={`focus-visible:ring-ring/50 -mb-px flex h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-inset ${
                      current
                        ? 'border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground border-transparent'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </>
  );
}

// Same shape as the real shell, so nothing jumps when the session check finishes.
function ShellSkeleton() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-label={t.common.loading}>
      <div className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="bg-muted h-8 w-48 animate-pulse rounded-lg motion-reduce:animate-none" />
          <div className="bg-muted h-8 w-24 animate-pulse rounded-lg motion-reduce:animate-none" />
        </div>
        <div className="mx-auto flex h-11 w-full max-w-5xl items-center px-4 sm:px-6">
          <div className="bg-muted h-5 w-44 animate-pulse rounded-lg motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:px-6">
        <div className="bg-muted h-8 w-40 animate-pulse rounded-lg motion-reduce:animate-none" />
        <div className="bg-muted h-40 animate-pulse rounded-lg motion-reduce:animate-none" />
      </div>
    </div>
  );
}
