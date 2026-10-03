import { describe, expect, it, vi } from 'vitest';
import { ApiError, createHttpUploadApi } from './api';

function setup(response: Response, token: string | null = 'token-1') {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  const api = createHttpUploadApi({
    baseUrl: 'https://api.test/',
    getAccessToken: async () => token,
    fetch: fetchMock,
  });
  return { api, fetchMock };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createHttpUploadApi', () => {
  it('sends the bearer token and JSON body', async () => {
    const { api, fetchMock } = setup(json(201, { videoId: 'v1', partSizeBytes: 1, partCount: 1 }));

    const result = await api.initiate({ fileName: 'a.mp4', sizeBytes: 5 });

    expect(result.videoId).toBe('v1');
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/uploads', {
      method: 'POST',
      headers: { authorization: 'Bearer token-1', 'content-type': 'application/json' },
      body: '{"fileName":"a.mp4","sizeBytes":5}',
    });
  });

  it('builds the per-video routes', async () => {
    const { api, fetchMock } = setup(new Response(null, { status: 204 }));

    await expect(api.abort('v 1')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.test/uploads/v%201');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' });
  });

  it("turns the API's error body into an ApiError with its code", async () => {
    const { api } = setup(
      json(413, { error: { code: 'QUOTA_EXCEEDED', message: 'Not enough free storage' } }),
    );

    const error = await api.initiate({ fileName: 'a.mp4', sizeBytes: 5 }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 413,
      code: 'QUOTA_EXCEEDED',
      message: 'Not enough free storage',
    });
  });

  it('survives an error response that is not JSON', async () => {
    const { api } = setup(new Response('Bad Gateway', { status: 502 }));

    await expect(api.getStorageUsage()).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' });
  });

  it('does not call the API when signed out', async () => {
    const { api, fetchMock } = setup(json(200, {}), null);

    await expect(api.getStorageUsage()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
