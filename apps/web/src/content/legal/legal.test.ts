import { describe, expect, it } from 'vitest';
import { cookies } from './cookies';
import { privacy } from './privacy';
import { terms } from './terms';
import { CONTACT_EMAIL, type LegalDocument } from './types';

const documents = { privacy, terms, cookies };

/** The outline of a document: how many paragraphs and list items each section has. */
const outline = (document: LegalDocument) =>
  document.sections.map((section) => [
    section.paragraphs?.length ?? 0,
    section.items?.length ?? 0,
    section.closing?.length ?? 0,
  ]);

describe.each(Object.entries(documents))('%s', (_name, document) => {
  it('says the same things, in the same order, in both languages', () => {
    expect(outline(document.es)).toEqual(outline(document.en));
    expect(document.es.intro).toHaveLength(document.en.intro.length);
  });

  it('leaves no text empty', () => {
    for (const version of [document.en, document.es]) {
      const texts = [
        version.title,
        version.description,
        ...version.intro,
        ...version.sections.flatMap((section) => [
          section.heading,
          ...(section.paragraphs ?? []),
          ...(section.items ?? []),
          ...(section.closing ?? []),
        ]),
      ];
      for (const text of texts) expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the legal texts', () => {
  it('tell people where to write, in both languages', () => {
    for (const version of [privacy.en, privacy.es, terms.en, terms.es]) {
      expect(version.intro.join(' ')).toContain(CONTACT_EMAIL);
    }
  });

  it('list every cookie the code sets', () => {
    for (const version of [cookies.en, cookies.es]) {
      const text = JSON.stringify(version);
      for (const name of [
        'cvp.lang',
        'cvp.session',
        'cvp.theme',
        'cvp.autoplay-next',
        'cvp.uploads-in-progress',
        'cvp.return-to',
      ]) {
        expect(text).toContain(name);
      }
    }
  });
});
