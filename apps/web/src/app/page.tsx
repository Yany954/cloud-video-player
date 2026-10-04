import { HardDriveUpload, ListVideo, Lock, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { LiquidMetalLogo } from '@/components/effects/liquid-metal-logo';
import { StageGradient } from '@/components/effects/stage-gradient';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeToggle } from '@/components/theme-control';
import { Button } from '@/components/ui/button';
import { HOME, SESSION_HINT_COOKIE } from '@/lib/auth/return-to';
import { getLocale, messagesFor } from '@/lib/i18n/server';

/** Where people can write to the people behind the app. Public on purpose. */
const CONTACT_EMAIL = 'cloudvideoplayer.contact@gmail.com';

export async function generateMetadata(): Promise<Metadata> {
  const { landing } = messagesFor(await getLocale());
  return { title: landing.title, description: landing.description };
}

// The public front door. Signed-in visitors skip it (see the session hint in auth-context.tsx).
export default async function LandingPage() {
  if ((await cookies()).has(SESSION_HINT_COOKIE)) redirect(HOME);
  const messages = messagesFor(await getLocale());
  const t = messages.landing;

  // Uneven on purpose: the first and last tiles are wide, the middle two narrow.
  const features = [
    { ...t.features.quality, icon: HardDriveUpload, span: 'lg:col-span-7' },
    { ...t.features.privacy, icon: Lock, span: 'lg:col-span-5' },
    { ...t.features.events, icon: Users, span: 'lg:col-span-5' },
    { ...t.features.play, icon: ListVideo, span: 'lg:col-span-7' },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="bg-background text-foreground focus-visible:ring-ring/50 sr-only z-50 rounded-lg px-4 py-2 outline-none focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-3"
      >
        {messages.common.skipToContent}
      </a>

      {/* The floating bar: frosted, with a rim of light. Plain CSS (see .light-rim). */}
      <header className="fixed inset-x-0 top-3 z-40 flex justify-center px-3">
        <div className="light-rim text-stage-foreground flex w-full max-w-3xl items-center justify-between gap-2 rounded-2xl py-2 pr-2 pl-3">
          <Brand compact />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemeToggle />
            <Button asChild size="lg">
              <Link href="/login">{t.signIn}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="content" className="flex-1">
        <section className="bg-stage text-stage-foreground relative isolate overflow-hidden">
          <StageGradient />
          {/* Keeps the text readable (WCAG AA) whatever the light behind it is doing. */}
          <div
            aria-hidden
            className="from-stage/90 via-stage/70 to-stage/20 absolute inset-0 bg-linear-to-r"
          />
          <div className="relative mx-auto grid min-h-[88dvh] w-full max-w-6xl items-center gap-12 px-5 pt-32 pb-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid max-w-xl gap-6">
              <p className="text-stage-muted text-sm font-medium tracking-wide uppercase">
                {t.eyebrow}
              </p>
              <h1 className="text-5xl leading-[1.05] font-semibold tracking-tighter text-balance sm:text-6xl">
                {t.heading}
              </h1>
              <p className="text-stage-muted max-w-[55ch] text-lg leading-relaxed">{t.lead}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" className="h-11 px-5 text-base">
                  <Link href="/login#create">{t.createAccount}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-stage-foreground/40 text-stage-foreground hover:bg-stage-foreground/10 hover:text-stage-foreground dark:border-stage-foreground/40 h-11 bg-transparent px-5 text-base dark:bg-transparent"
                >
                  <Link href="/login">{t.signIn}</Link>
                </Button>
              </div>
              <p className="text-stage-muted text-sm">{t.startNote}</p>
            </div>
            <LiquidMetalLogo className="mx-auto w-52 sm:w-64 lg:w-full lg:max-w-sm" />
          </div>
        </section>

        <section
          aria-labelledby="features-title"
          className="scroll-mt-24 mx-auto grid w-full max-w-6xl gap-8 px-5 py-20 sm:px-8"
        >
          <h2 id="features-title" className="text-3xl font-semibold tracking-tight text-balance">
            {t.featuresTitle}
          </h2>
          <ul className="grid gap-4 lg:grid-cols-12">
            {features.map(({ title, text, icon: Icon, span }) => (
              <li
                key={title}
                className={`bg-card grid gap-3 rounded-3xl border p-6 sm:p-8 ${span}`}
              >
                <Icon aria-hidden className="text-primary size-6" strokeWidth={1.75} />
                <h3 className="text-xl font-semibold tracking-tight text-balance">{title}</h3>
                <p className="text-muted-foreground max-w-[60ch] leading-relaxed">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="facts-title" className="scroll-mt-24 border-y">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <h2 id="facts-title" className="text-3xl font-semibold tracking-tight text-balance">
              {t.factsTitle}
            </h2>
            <dl className="divide-y">
              {Object.values(t.facts).map(({ label, value }) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl justify-items-start gap-5 px-5 py-20 sm:px-8">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.closingTitle}
          </h2>
          <p className="text-muted-foreground text-lg">{t.closingText}</p>
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href="/login#create">{t.createAccount}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-8 text-sm sm:px-8">
          <p>{t.footerRights}</p>
          <p>
            {t.footerContact}:{' '}
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
