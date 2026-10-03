import type { StorageUsageResponse } from '@cvp/shared';
import { getStorageUsage } from './container';
import { json, route, userIdOf } from './http';

// GET /me/storage
export const handler = route(async (event) => {
  const usage = await getStorageUsage.execute({ userId: userIdOf(event) });
  return json(200, usage satisfies StorageUsageResponse);
});
