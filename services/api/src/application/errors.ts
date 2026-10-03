/** The video doesn't exist or belongs to someone else. Deliberately the same error for both. */
export class NotFoundError extends Error {
  constructor(message = 'Video not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
