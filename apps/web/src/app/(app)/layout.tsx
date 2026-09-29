import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { WakeServices } from '@/components/layout/wake-services';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WakeServices />
      <AppShell>{children}</AppShell>
    </>
  );
}
