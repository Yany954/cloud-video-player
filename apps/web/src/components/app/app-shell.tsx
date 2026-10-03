'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';

/** Signed-in frame. Sends signed-out visitors to /login. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'signedOut') router.replace('/login');
  }, [state.status, router]);

  if (state.status !== 'signedIn') return <ShellSkeleton />;

  return (
    <>
      <a
        href="#content"
        className="bg-background text-foreground focus-visible:ring-ring/50 sr-only rounded-lg px-4 py-2 outline-none focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:ring-3"
      >
        Skip to content
      </a>
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-3"
          >
            <Brand />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden max-w-56 truncate text-sm sm:block">
              {state.user.email}
            </span>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </>
  );
}

// Same shape as the real shell, so nothing jumps when the session check finishes.
function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="bg-muted h-8 w-48 animate-pulse rounded-lg motion-reduce:animate-none" />
          <div className="bg-muted h-8 w-24 animate-pulse rounded-lg motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:px-6">
        <div className="bg-muted h-8 w-40 animate-pulse rounded-lg motion-reduce:animate-none" />
        <div className="bg-muted h-40 animate-pulse rounded-lg motion-reduce:animate-none" />
      </div>
    </div>
  );
}
