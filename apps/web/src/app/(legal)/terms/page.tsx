import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/legal-document';
import { terms } from '@/content/legal/terms';
import { getLocale, messagesFor } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const document = terms[await getLocale()];
  return { title: `${document.title} | Cloud Video Player`, description: document.description };
}

export default async function Page() {
  const locale = await getLocale();
  return (
    <LegalDocumentView document={terms[locale]} locale={locale} t={messagesFor(locale).legal} />
  );
}
