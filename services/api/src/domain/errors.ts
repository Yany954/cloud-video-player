export type DomainErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_SIZE'
  | 'INVALID_TITLE'
  | 'INVALID_NAME'
  | 'INVALID_ORDER'
  | 'INVALID_NOTE'
  | 'INVALID_QUOTA'
  | 'USER_EXISTS'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_STATE'
  | 'UPLOAD_INCOMPLETE';

/** A business rule was broken. Handlers map `code` to an HTTP status; no AWS or HTTP knowledge here. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
