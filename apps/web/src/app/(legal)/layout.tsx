import Link from 'next/link';
import { Brand } from '@/components/brand';
import { LanguageSwitch } from '@/components/language-switch';
import { LegalLinks } from '@/components/legal/legal-links';
import { ThemeToggle } from '@/components/theme-control';
import { CONTACT_EMAIL } from '@/content/legal/types';
import { getLocale, messagesFor } from '@/lib/i18n/server';

// The public legal pages: readable by anyone, signed in or not.
export default async function LegalLayout({ children }: LayoutProps<'/'>) {
  const messages = messagesFor(await getLocale());
  const t = messages.legal;
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="bg-background text-foreground focus-visible:ring-ring/50 sr-only z-50 rounded-lg px-4 py-2 outline-none focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-3"
      >
        {messages.common.skipToContent}
      </a>
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-3"
          >
            <Brand compact />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        {children}
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto grid w-full max-w-4xl gap-3 px-4 py-8 text-sm sm:px-6">
          <LegalLinks t={t} />
          <p>
            {t.contact}:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              translate="no"
              className="text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
