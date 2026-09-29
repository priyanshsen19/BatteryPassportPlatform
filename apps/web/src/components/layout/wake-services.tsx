'use client';

import { useEffect } from 'react';

/**
 * Asks the server to start waking the backend services as soon as a page opens (sign-in pages and
 * the signed-in app), so a visit, not a scheduled job, is what brings them up.
 */
export function WakeServices() {
  useEffect(() => {
    fetch('/api/warmup', { method: 'POST' }).catch(() => undefined);
  }, []);
  return null;
}
