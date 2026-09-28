'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { parseResponse } from '@/lib/api-client';

export const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: 'Google sign-in is not configured for this deployment.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in failed. Please try again.',
  google_email_unverified: 'Your Google account email is not verified.',
  account_linked_elsewhere: 'This email is already linked to a different Google account.',
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

/** "Continue with Google", shown only when the deployment has Google OAuth configured. */
export function GoogleSignIn({ next }: { next?: string }) {
  const { data } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: async () =>
      parseResponse<{ google: boolean }>(await fetch('/api/auth/providers'), { redirectOn401: false }),
    staleTime: Infinity,
  });

  if (!data?.google) return null;

  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-subtle">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" className="w-full" asChild>
        <a href={href}>
          <GoogleIcon />
          Continue with Google
        </a>
      </Button>
    </>
  );
}
