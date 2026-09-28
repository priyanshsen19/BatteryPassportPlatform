import { FileLock2, QrCode, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';

const HIGHLIGHTS = [
  { icon: QrCode, text: 'A scannable digital passport for every battery' },
  { icon: FileLock2, text: 'Certificates and reports stored privately in S3' },
  { icon: ShieldCheck, text: 'Role-based access for administrators and viewers' },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[48px] border-brand/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 -bottom-8 size-48 rounded-full border-[24px] border-brand/15"
          aria-hidden
        />
        <Logo tone="on-dark" className="h-8" priority />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-sidebar-ink">
            Battery passports, from factory to second life.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-sidebar-muted">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-raised text-brand">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <Logo className="h-7" priority />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
