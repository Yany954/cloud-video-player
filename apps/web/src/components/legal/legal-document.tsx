import { LEGAL_UPDATED, type LegalDocument } from '@/content/legal/types';
import type { Locale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages/en';

/** One legal text, as plain readable HTML: headings, paragraphs and lists. */
export function LegalDocumentView({
  document,
  locale,
  t,
}: {
  document: LegalDocument;
  locale: Locale;
  t: Messages['legal'];
}) {
  // Noon UTC, so the date reads the same in every time zone.
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${LEGAL_UPDATED}T12:00:00Z`),
  );
  return (
    <article className="grid gap-10">
      <header className="grid gap-3">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">{document.title}</h1>
        <p className="text-muted-foreground text-sm">
          {t.updated} <time dateTime={LEGAL_UPDATED}>{updated}</time>
        </p>
        {document.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-[70ch] text-lg leading-relaxed">
            {paragraph}
          </p>
        ))}
      </header>
      {document.sections.map((section) => (
        <section key={section.heading} className="grid max-w-[70ch] gap-3">
          <h2 className="scroll-mt-8 text-xl font-semibold tracking-tight text-balance">
            {section.heading}
          </h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="grid list-disc gap-2 pl-5 leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.closing?.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
