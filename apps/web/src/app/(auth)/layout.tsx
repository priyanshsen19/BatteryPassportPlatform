import { BatteryCharging } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent text-white">
            <BatteryCharging className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-ink">Battery Passport Platform</span>
        </div>
        {children}
      </div>
    </main>
  );
}
