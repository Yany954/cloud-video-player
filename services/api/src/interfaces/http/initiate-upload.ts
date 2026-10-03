import { initiateUploadRequestSchema, type InitiateUploadResponse } from '@cvp/shared';
import { initiateUpload } from './container';
import { json, parseBody, route, userIdOf } from './http';

// POST /uploads
export const handler = route(async (event) => {
  const body = parseBody(event, initiateUploadRequestSchema);
  const result = await initiateUpload.execute({ ...body, userId: userIdOf(event) });
  return json(201, result satisfies InitiateUploadResponse);
});
