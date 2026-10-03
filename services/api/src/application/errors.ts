/** The caller is signed in but is not allowed to do this, e.g. a non-admin reviewing a video. */
export class ForbiddenError extends Error {
  constructor(message = 'Not allowed') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** The video doesn't exist or is not visible to the caller. Deliberately the same error for both. */
export class NotFoundError extends Error {
  constructor(message = 'Video not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
