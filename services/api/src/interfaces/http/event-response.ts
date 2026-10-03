import type { EventResponse } from '@cvp/shared';
import { canManageCategory, isMember, type Category } from '../../domain/category';

/** What clients see: no owner id and no collaborator ids. Called an "event" outside the API code. */
export function toEventResponse(category: Category, userId: string): EventResponse {
  return {
    id: category.id,
    name: category.name,
    visibility: category.visibility,
    isOwner: canManageCategory(category, userId),
    isMember: isMember(category, userId),
    createdAt: category.createdAt,
  };
}
