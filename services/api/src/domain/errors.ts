export type DomainErrorCode =
  'UNSUPPORTED_FORMAT' | 'INVALID_SIZE' | 'INVALID_TITLE' | 'QUOTA_EXCEEDED' | 'INVALID_STATE';

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
