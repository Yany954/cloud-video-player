import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/legal-document';
import { privacy } from '@/content/legal/privacy';
import { getLocale, messagesFor } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const document = privacy[await getLocale()];
  return { title: `${document.title} | Cloud Video Player`, description: document.description };
}

export default async function Page() {
  const locale = await getLocale();
  return (
    <LegalDocumentView document={privacy[locale]} locale={locale} t={messagesFor(locale).legal} />
  );
}
