import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { Brand } from '@/components/brand';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeToggle } from '@/components/theme-control';
import { getLocale, messagesFor } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor(await getLocale()).loginPage.title };
}

// Layout adapted from the watermelon-ui auth-05 block: form on the left, panel on the right.
export default async function LoginPage() {
  const t = messagesFor(await getLocale()).loginPage;
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
        </div>
      </main>

      <aside className="bg-stage text-stage-foreground relative hidden flex-1 overflow-hidden rounded-3xl lg:flex lg:items-end lg:p-14">
        {/* Stage lights: decorative only. Replace with a real photo in public/ when one is chosen. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_25%_0%,oklch(0.6_0.2_262/0.55),transparent_70%),radial-gradient(45%_40%_at_85%_10%,oklch(0.7_0.14_230/0.35),transparent_70%),radial-gradient(70%_50%_at_60%_110%,oklch(0.45_0.18_275/0.5),transparent_70%)]"
        />
        <div className="relative grid max-w-md gap-3">
          <p className="text-3xl leading-tight font-semibold tracking-tight">{t.asideTitle}</p>
          <p className="text-stage-muted text-base leading-relaxed">{t.asideText}</p>
        </div>
      </aside>
    </div>
  );
}
