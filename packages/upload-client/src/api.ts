import type {
  ApiErrorResponse,
  InitiateUploadRequest,
  InitiateUploadResponse,
  ListVideosResponse,
  PartUrlsResponse,
  StorageUsageResponse,
  VideoResponse,
} from '@cvp/shared';

/** The upload endpoints, as the engine needs them. */
export interface UploadApi {
  initiate(request: InitiateUploadRequest): Promise<InitiateUploadResponse>;
  getPartUrls(videoId: string): Promise<PartUrlsResponse>;
  complete(videoId: string): Promise<VideoResponse>;
  abort(videoId: string): Promise<void>;
  getStorageUsage(): Promise<StorageUsageResponse>;
  listVideos(): Promise<ListVideosResponse>;
}

/** The API answered with an error. `code` is the server's error code, e.g. QUOTA_EXCEEDED. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HttpUploadApiOptions {
  baseUrl: string;
  /** Called before every request, so an expired token gets refreshed. */
  getAccessToken(): Promise<string | null>;
  fetch?: typeof fetch;
}

/** Works anywhere `fetch` exists: browsers and React Native. */
export function createHttpUploadApi(options: HttpUploadApiOptions): UploadApi {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'You are signed out');

    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      throw new ApiError(
        response.status,
        payload?.error?.code ?? 'UNKNOWN',
        payload?.error?.message ?? `Request failed with status ${response.status}`,
      );
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  const id = encodeURIComponent;
  return {
    initiate: (body) => request('POST', '/uploads', body),
    getPartUrls: (videoId) => request('GET', `/uploads/${id(videoId)}/parts`),
    complete: (videoId) => request('POST', `/uploads/${id(videoId)}/complete`),
    abort: (videoId) => request('DELETE', `/uploads/${id(videoId)}`),
    getStorageUsage: () => request('GET', '/me/storage'),
    listVideos: () => request('GET', '/videos'),
  };
}
