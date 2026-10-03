import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ForbiddenError, NotFoundError } from '../../application/errors';
import { DomainError } from '../../domain/errors';
import {
  parseBody,
  parseQuery,
  pathParam,
  route,
  userIdOf,
  viewerOf,
  type HttpEvent,
} from './http';

const event = (overrides: Partial<HttpEvent> = {}) =>
  ({
    requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } },
    ...overrides,
  }) as HttpEvent;

const failing = (error: unknown) =>
  route(async () => {
    throw error;
  })(event());

const body = (result: { body?: string }) => JSON.parse(result.body ?? '{}');

describe('route error mapping', () => {
  it.each([
    ['QUOTA_EXCEEDED', 413],
    ['UNSUPPORTED_FORMAT', 415],
    ['INVALID_STATE', 409],
    ['UPLOAD_INCOMPLETE', 409],
    ['INVALID_SIZE', 400],
    ['INVALID_TITLE', 400],
    ['INVALID_NAME', 400],
    ['INVALID_ORDER', 400],
  ] as const)('maps %s to HTTP %i', async (code, status) => {
    const result = await failing(new DomainError(code, 'why'));

    expect(result.statusCode).toBe(status);
    expect(body(result)).toEqual({ error: { code, message: 'why' } });
  });

  it('maps an action the caller is not allowed to do to 403', async () => {
    const result = await failing(new ForbiddenError());

    expect(result.statusCode).toBe(403);
    expect(body(result).error.code).toBe('FORBIDDEN');
  });

  it('maps a missing or foreign video to 404', async () => {
    const result = await failing(new NotFoundError());

    expect(result.statusCode).toBe(404);
    expect(body(result).error.code).toBe('NOT_FOUND');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await failing(new Error('table cvp-dev-data exploded'));

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('cvp-dev-data');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('request parsing', () => {
  const schema = z.object({ sizeBytes: z.number().int().positive() });

  it('parses a valid JSON body', () => {
    expect(parseBody(event({ body: '{"sizeBytes":5}' }), schema)).toEqual({ sizeBytes: 5 });
  });

  it('decodes a base64 body', () => {
    const encoded = Buffer.from('{"sizeBytes":5}').toString('base64');
    expect(parseBody(event({ body: encoded, isBase64Encoded: true }), schema)).toEqual({
      sizeBytes: 5,
    });
  });

  it.each([
    ['not json', 'BAD_REQUEST'],
    ['{"sizeBytes":"big"}', 'VALIDATION'],
    [undefined, 'BAD_REQUEST'],
  ])('rejects body %j with 400 %s', async (raw, code) => {
    const result = await route(async (e) => {
      parseBody(e, schema);
      return { statusCode: 200 };
    })(event({ body: raw }));

    expect(result.statusCode).toBe(400);
    expect(body(result).error.code).toBe(code);
  });

  it('coerces query strings and treats a missing query as empty', () => {
    const query = z.object({ limit: z.coerce.number().int().optional() });
    expect(parseQuery(event({ queryStringParameters: { limit: '20' } }), query)).toEqual({
      limit: 20,
    });
    expect(parseQuery(event(), query)).toEqual({});
  });

  it('reads the user id from the validated token and required path parameters', () => {
    expect(userIdOf(event())).toBe('user-1');
    expect(pathParam(event({ pathParameters: { videoId: 'v1' } }), 'videoId')).toBe('v1');
    expect(() => pathParam(event(), 'videoId')).toThrow('Missing path parameter');
  });
});

describe('viewerOf', () => {
  const withGroups = (groups?: string) =>
    ({
      requestContext: {
        authorizer: { jwt: { claims: { sub: 'user-1', 'cognito:groups': groups } } },
      },
    }) as unknown as HttpEvent;

  it('recognises an admin from the groups in the token', () => {
    expect(viewerOf(withGroups('[admin user]'))).toEqual({ userId: 'user-1', isAdmin: true });
  });

  it('treats everyone else, and a token with no groups, as a normal user', () => {
    expect(viewerOf(withGroups('[user]')).isAdmin).toBe(false);
    expect(viewerOf(withGroups()).isAdmin).toBe(false);
    expect(viewerOf(withGroups('[administrators]')).isAdmin).toBe(false);
  });
});
