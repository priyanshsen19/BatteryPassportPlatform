'use client';

import { useEffect } from 'react';

/** Asks the server to start waking the backend services as soon as the page opens. */
export function WakeServices() {
  useEffect(() => {
    fetch('/api/warmup', { method: 'POST' }).catch(() => undefined);
  }, []);
  return null;
}
