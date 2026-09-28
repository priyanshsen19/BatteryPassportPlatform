import { Errors, type Logger } from '@bpp/shared';

export interface PassportClient {
  /** Throws a 422 when the passport does not exist. */
  assertPassportExists(passportId: string, authorization: string, requestId: string): Promise<void>;
}

/**
 * Checks with the Passport Service (over HTTP, forwarding the caller's token) that a passport
 * exists before documents are linked to it. This service never reads the passport database.
 */
export function createPassportClient(options: { baseUrl: string; timeoutMs: number; logger: Logger }): PassportClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    async assertPassportExists(passportId, authorization, requestId) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/passports/${encodeURIComponent(passportId)}`, {
          headers: { authorization, 'x-request-id': requestId },
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch (err) {
        options.logger.error('Passport service request failed', { requestId, error: (err as Error).message });
        throw Errors.serviceUnavailable('PASSPORT_SERVICE_UNAVAILABLE', 'Passport service is unavailable');
      }

      if (response.ok) return;
      if (response.status === 404) {
        throw Errors.validation([{ field: 'passportId', message: `Battery passport ${passportId} does not exist` }]);
      }
      options.logger.error('Passport service returned an unexpected status', { requestId, status: response.status });
      throw Errors.badGateway('PASSPORT_SERVICE_ERROR', 'Passport service returned an unexpected response');
    },
  };
}
