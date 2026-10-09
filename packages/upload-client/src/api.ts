import type {
  ApiErrorResponse,
  BlockResponse,
  CreateEventRequest,
  EventDetailResponse,
  EventInviteResponse,
  EventResponse,
  InitiateUploadRequest,
  InitiateUploadResponse,
  ListBlocksResponse,
  ListEventsResponse,
  ListUsersResponse,
  ListVideosResponse,
  PartUrlsResponse,
  PlaybackResponse,
  ReportVideoRequest,
  ReviewDecision,
  ReviewQueueResponse,
  StorageUsageResponse,
  UpdateEventRequest,
  UpdateUserRequest,
  UserResponse,
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
  getPlayback(videoId: string): Promise<PlaybackResponse>;
  /** Approved videos from every user. */
  listLibrary(): Promise<ListVideosResponse>;
  /** Admins only: videos waiting for a decision, with the reports made against them. */
  listReviewQueue(): Promise<ReviewQueueResponse>;
  /** Admins only. */
  reviewVideo(videoId: string, decision: ReviewDecision): Promise<VideoResponse>;
  /** Permanent. Owners delete their own videos; admins can delete any. */
  deleteVideo(videoId: string): Promise<void>;
  createEvent(request: CreateEventRequest): Promise<EventResponse>;
  listEvents(): Promise<ListEventsResponse>;
  /** The event and the videos the caller may see, in playing order. */
  getEvent(eventId: string): Promise<EventDetailResponse>;
  updateEvent(eventId: string, request: UpdateEventRequest): Promise<EventResponse>;
  /** `videoIds` is the whole new playing order. */
  reorderEvent(eventId: string, videoIds: string[]): Promise<void>;
  /** Only an empty event can be deleted. */
  deleteEvent(eventId: string): Promise<void>;
  /** Moves one of the caller's videos into an event, or out with `null`. */
  setVideoEvent(videoId: string, eventId: string | null): Promise<VideoResponse>;
  /** Only the owner can rename a video. */
  renameVideo(videoId: string, title: string): Promise<VideoResponse>;
  /** Owner only. Makes a new invite link; any earlier one stops working. */
  openInvite(eventId: string): Promise<EventInviteResponse>;
  /** Owner only. Turns the invite link off. */
  closeInvite(eventId: string): Promise<void>;
  /** What opening an invite link does: the caller becomes a collaborator. */
  joinEvent(eventId: string, token: string): Promise<EventResponse>;
  /** The owner removes anyone; a collaborator removes only themselves. */
  removeCollaborator(eventId: string, userId: string): Promise<void>;
  /** Admins only. */
  listUsers(): Promise<ListUsersResponse>;
  /** Admins only. Creates the account and emails a temporary password. */
  inviteUser(email: string): Promise<UserResponse>;
  /** Admins only. Changes the quota, the role, or whether the account can sign in. */
  updateUser(userId: string, change: UpdateUserRequest): Promise<UserResponse>;
  /** Admins only, and never their own account. Permanent: removes the person's data too. */
  deleteUser(userId: string): Promise<void>;
  /** Permanent. The password proves it is the account's owner asking. */
  deleteMyAccount(password: string): Promise<void>;
  /** Hides the video until an admin reviews it. For other people's videos only. */
  reportVideo(videoId: string, report: ReportVideoRequest): Promise<void>;
  /** Blocks whoever uploaded this video: their videos disappear for the caller. */
  blockUploader(videoId: string): Promise<BlockResponse>;
  listBlocks(): Promise<ListBlocksResponse>;
  unblock(blockId: string): Promise<void>;
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
    // 202 (accepted, work continues in the background) and 204 carry no body.
    const empty = response.status === 204 || response.status === 202;
    return (empty ? undefined : await response.json()) as T;
  }

  const id = encodeURIComponent;
  return {
    initiate: (body) => request('POST', '/uploads', body),
    getPartUrls: (videoId) => request('GET', `/uploads/${id(videoId)}/parts`),
    complete: (videoId) => request('POST', `/uploads/${id(videoId)}/complete`),
    abort: (videoId) => request('DELETE', `/uploads/${id(videoId)}`),
    getStorageUsage: () => request('GET', '/me/storage'),
    listVideos: () => request('GET', '/videos'),
    getPlayback: (videoId) => request('GET', `/videos/${id(videoId)}/playback`),
    listLibrary: () => request('GET', '/library'),
    listReviewQueue: () => request('GET', '/admin/review'),
    reviewVideo: (videoId, decision) =>
      request('POST', `/admin/videos/${id(videoId)}/review`, { decision }),
    deleteVideo: (videoId) => request('DELETE', `/videos/${id(videoId)}`),
    createEvent: (body) => request('POST', '/events', body),
    listEvents: () => request('GET', '/events'),
    getEvent: (eventId) => request('GET', `/events/${id(eventId)}`),
    updateEvent: (eventId, body) => request('PATCH', `/events/${id(eventId)}`, body),
    reorderEvent: (eventId, videoIds) =>
      request('PUT', `/events/${id(eventId)}/order`, { videoIds }),
    deleteEvent: (eventId) => request('DELETE', `/events/${id(eventId)}`),
    renameVideo: (videoId, title) => request('PATCH', `/videos/${id(videoId)}`, { title }),
    setVideoEvent: (videoId, eventId) =>
      request('PUT', `/videos/${id(videoId)}/event`, { eventId }),
    openInvite: (eventId) => request('PUT', `/events/${id(eventId)}/invite`),
    closeInvite: (eventId) => request('DELETE', `/events/${id(eventId)}/invite`),
    joinEvent: (eventId, token) => request('POST', `/events/${id(eventId)}/join`, { token }),
    removeCollaborator: (eventId, userId) =>
      request('DELETE', `/events/${id(eventId)}/collaborators/${id(userId)}`),
    listUsers: () => request('GET', '/admin/users'),
    inviteUser: (email) => request('POST', '/admin/users', { email }),
    updateUser: (userId, change) => request('PATCH', `/admin/users/${id(userId)}`, change),
    deleteUser: (userId) => request('DELETE', `/admin/users/${id(userId)}`),
    deleteMyAccount: (password) => request('POST', '/me/deletion', { password }),
    reportVideo: (videoId, report) => request('POST', `/videos/${id(videoId)}/reports`, report),
    blockUploader: (videoId) => request('POST', '/me/blocks', { videoId }),
    listBlocks: () => request('GET', '/me/blocks'),
    unblock: (blockId) => request('DELETE', `/me/blocks/${id(blockId)}`),
  };
}
