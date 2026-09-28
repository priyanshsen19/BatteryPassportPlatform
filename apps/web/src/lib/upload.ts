import type { UploadDocumentResult } from '@bpp/shared/schemas';
import { ApiError, toApiError } from './api-client';

/** Uploads through XMLHttpRequest because fetch does not report upload progress. */
export function uploadDocument(
  file: File,
  passportId: string | undefined,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadDocumentResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    if (passportId) form.append('passportId', passportId);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/proxy/documents/upload');
    xhr.responseType = 'json';

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      const body = xhr.response as { success?: boolean; data?: UploadDocumentResult } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data) resolve(body.data);
      else reject(toApiError(xhr.status, body));
    });
    xhr.addEventListener('error', () =>
      reject(new ApiError(0, 'NETWORK_ERROR', 'The upload failed. Check your connection and try again.')),
    );
    xhr.addEventListener('abort', () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled')));
    signal?.addEventListener('abort', () => xhr.abort());

    xhr.send(form);
  });
}
