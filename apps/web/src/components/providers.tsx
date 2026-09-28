'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            // Client errors (401/403/404/422) will not succeed on retry.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'border border-line bg-surface text-ink shadow-sm rounded-lg text-sm',
            description: 'text-ink-muted',
          },
        }}
      />
    </QueryClientProvider>
  );
}
