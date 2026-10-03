import { describe, expect, it } from 'vitest';
import { createCategory, setVisibility } from '../domain/category';
import { fromCategoryItem, toCategoryItem } from './category-item';

const category = createCategory({
  id: 'cat-1',
  ownerId: 'ana',
  name: 'Concert',
  now: new Date('2026-10-03T10:00:00.000Z'),
});

describe('category item mapping', () => {
  it('lists every category under its owner, apart from the owner’s videos', () => {
    expect(toCategoryItem(category)).toMatchObject({
      PK: 'CATEGORY#cat-1',
      SK: 'META',
      type: 'Category',
      GSI1PK: 'OWNER#ana#CATEGORIES',
      GSI1SK: '2026-10-03T10:00:00.000Z',
    });
  });

  it('lists only shared categories for everyone', () => {
    expect(toCategoryItem(category)).not.toHaveProperty('GSI2PK');
    expect(toCategoryItem(setVisibility(category, 'shared'))).toMatchObject({
      GSI2PK: 'CATEGORIES',
      GSI2SK: '2026-10-03T10:00:00.000Z',
    });
  });

  it('round-trips without leaking table keys into the domain', () => {
    expect(fromCategoryItem(toCategoryItem(category))).toEqual(category);
  });
});
