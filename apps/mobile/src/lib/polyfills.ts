// The upload engine shared with the website (packages/upload-client) uses
// `AbortSignal.throwIfAborted()`, which browsers have and React Native's JavaScript engine does
// not yet. Loaded once, before anything else, from the root layout.

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

type Patchable = { throwIfAborted?: () => void; aborted: boolean; reason?: unknown };

const prototype = AbortSignal.prototype as unknown as Patchable;
if (typeof prototype.throwIfAborted !== 'function') {
  prototype.throwIfAborted = function throwIfAborted(this: Patchable) {
    if (this.aborted) throw this.reason ?? abortError();
  };
}
