import type { PutPart } from '@cvp/upload-client';

/**
 * Sends one slice of the file straight to S3. Uses XMLHttpRequest because `fetch` cannot
 * report upload progress. `File.slice` reads lazily, so a 10 GB file is never held in memory.
 */
export const putPartFromBrowser: PutPart<File> = ({
  source,
  url,
  start,
  end,
  signal,
  onProgress,
}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();

    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      signal.removeEventListener('abort', abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the part with status ${xhr.status}`));
    };
    xhr.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('Network error while uploading'));
    };
    xhr.onabort = () => reject(new DOMException('Upload paused', 'AbortError'));

    signal.addEventListener('abort', abort, { once: true });
    xhr.open('PUT', url);
    xhr.send(source.slice(start, end));
  });
