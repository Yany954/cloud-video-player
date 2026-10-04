import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/auth-context';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { getLocale } from '@/lib/i18n/server';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Cloud Video Player',
  description: 'Store and stream your live event videos privately.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Read per request, so the very first paint is already in the visitor's language.
  const locale = await getLocale();
  return (
    // The boot script sets data-theme before React starts, so the attribute differs from the
    // server's markup by design.
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
