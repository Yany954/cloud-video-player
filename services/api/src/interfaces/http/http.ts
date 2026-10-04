import type { ApiErrorResponse } from '@cvp/shared';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { z, ZodError, type ZodType } from 'zod';
import { ForbiddenError, NotFoundError } from '../../application/errors';
import { DomainError, type DomainErrorCode } from '../../domain/errors';
import type { Viewer } from '../../domain/moderation';
import { parseGroups } from './claims';

export type HttpEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type HttpResult = APIGatewayProxyStructuredResultV2;

export class BadRequestError extends Error {}

const DOMAIN_ERROR_STATUS: Record<DomainErrorCode, number> = {
  INVALID_SIZE: 400,
  INVALID_TITLE: 400,
  INVALID_NAME: 400,
  INVALID_ORDER: 400,
  INVALID_QUOTA: 400,
  USER_EXISTS: 409,
  INVALID_STATE: 409,
  UPLOAD_INCOMPLETE: 409,
  QUOTA_EXCEEDED: 413,
  UNSUPPORTED_FORMAT: 415,
};

export function json(statusCode: number, body: unknown): HttpResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** The caller's Cognito user id. API Gateway has already validated the token. */
export const userIdOf = (event: HttpEvent) =>
  String(event.requestContext.authorizer.jwt.claims.sub);

/** The caller and whether their token says they belong to the `admin` group. */
export function viewerOf(event: HttpEvent): Viewer {
  const groups = parseGroups(event.requestContext.authorizer.jwt.claims['cognito:groups']);
  return { userId: userIdOf(event), isAdmin: groups.includes('admin') };
}

export function pathParam(event: HttpEvent, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) throw new BadRequestError(`Missing path parameter: ${name}`);
  return value;
}

export function parseBody<T>(event: HttpEvent, schema: ZodType<T>): T {
  let raw: unknown;
  try {
    const text = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '');
    raw = JSON.parse(text);
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
  return schema.parse(raw);
}

export function parseQuery<T>(event: HttpEvent, schema: ZodType<T>): T {
  return schema.parse(event.queryStringParameters ?? {});
}

function error(statusCode: number, code: string, message: string): HttpResult {
  return json(statusCode, { error: { code, message } } satisfies ApiErrorResponse);
}

export function errorResponse(caught: unknown): HttpResult {
  if (caught instanceof DomainError) {
    return error(DOMAIN_ERROR_STATUS[caught.code], caught.code, caught.message);
  }
  if (caught instanceof ForbiddenError) return error(403, 'FORBIDDEN', caught.message);
  if (caught instanceof NotFoundError) return error(404, 'NOT_FOUND', caught.message);
  if (caught instanceof ZodError) return error(400, 'VALIDATION', z.prettifyError(caught));
  if (caught instanceof BadRequestError) return error(400, 'BAD_REQUEST', caught.message);
  // Unexpected: log the details, never send them to the client.
  console.error(caught);
  return error(500, 'INTERNAL', 'Something went wrong');
}

/** Wraps a route so every thrown error becomes a consistent JSON response. */
export function route(run: (event: HttpEvent) => Promise<HttpResult>) {
  return async (event: HttpEvent): Promise<HttpResult> => {
    try {
      return await run(event);
    } catch (caught) {
      return errorResponse(caught);
    }
  };
}
