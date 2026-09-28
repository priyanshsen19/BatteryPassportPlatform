import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs text-ink-subtle">404</p>
      <h1 className="mt-2 text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1 text-[13px] text-ink-muted">The page you are looking for does not exist.</p>
      <Link
        href="/dashboard"
        className="mt-5 text-[13px] font-medium text-accent underline-offset-4 hover:underline"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
