import type { Category } from '../domain/category';

// Single-table key patterns. See infra/lib/data-stack.ts for the full table.
export const categoryKey = (categoryId: string) => ({ PK: `CATEGORY#${categoryId}`, SK: 'META' });

/** GSI1: one owner's categories, by creation time. A different partition from their videos. */
export const ownedCategoriesIndex = {
  name: 'GSI1',
  partitionKey: (ownerId: string) => `OWNER#${ownerId}#CATEGORIES`,
};

/** GSI2: the categories every signed-in user can see. Sparse: private ones have no keys. */
export const sharedCategoriesIndex = { name: 'GSI2', partitionKey: 'CATEGORIES' };

export type CategoryItem = Category &
  ReturnType<typeof categoryKey> & {
    type: 'Category';
    GSI1PK: string;
    GSI1SK: string;
    GSI2PK?: string;
    GSI2SK?: string;
  };

export function toCategoryItem(category: Category): CategoryItem {
  return {
    ...categoryKey(category.id),
    type: 'Category',
    GSI1PK: ownedCategoriesIndex.partitionKey(category.ownerId),
    GSI1SK: category.createdAt,
    ...(category.visibility === 'shared' && {
      GSI2PK: sharedCategoriesIndex.partitionKey,
      GSI2SK: category.createdAt,
    }),
    ...category,
  };
}

/** `item` is whatever DynamoDB returned for a key built with `categoryKey`. */
export function fromCategoryItem(item: object): Category {
  const category = item as CategoryItem;
  return {
    id: category.id,
    ownerId: category.ownerId,
    name: category.name,
    visibility: category.visibility,
    collaboratorIds: category.collaboratorIds,
    order: category.order,
    createdAt: category.createdAt,
  };
}
