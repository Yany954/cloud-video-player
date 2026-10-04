import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { Brand } from '@/components/brand';
import { StageGradient } from '@/components/effects/stage-gradient';
import { LanguageSwitch } from '@/components/language-switch';
import { LegalLinks } from '@/components/legal/legal-links';
import { ThemeToggle } from '@/components/theme-control';
import { getLocale, messagesFor } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor(await getLocale()).loginPage.title };
}

// Layout adapted from the watermelon-ui auth-05 block: form on the left, panel on the right.
export default async function LoginPage() {
  const messages = messagesFor(await getLocale());
  const t = messages.loginPage;
  return (
    <div className="flex min-h-dvh w-full flex-col p-2 lg:flex-row">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:max-w-xl lg:px-16">
        <div className="grid w-full max-w-sm gap-10">
          <div className="flex items-center justify-between gap-4">
            <Brand />
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <ThemeToggle />
            </div>
          </div>
          <LoginForm />
          <p className="text-muted-foreground text-sm">{t.privacyNote}</p>
          <LegalLinks t={messages.legal} className="text-muted-foreground text-sm" />
        </div>
      </main>

      <aside className="bg-stage text-stage-foreground relative hidden flex-1 overflow-hidden rounded-3xl lg:flex lg:items-end lg:p-14">
        <StageGradient subtle />
        {/* Keeps the text readable whatever the light behind it is doing. */}
        <div aria-hidden className="from-stage/85 to-stage/10 absolute inset-0 bg-linear-to-t" />
        <div className="relative grid max-w-md gap-3">
          <p className="text-3xl leading-tight font-semibold tracking-tight">{t.asideTitle}</p>
          <p className="text-stage-muted text-base leading-relaxed">{t.asideText}</p>
        </div>
      </aside>
    </div>
  );
}
