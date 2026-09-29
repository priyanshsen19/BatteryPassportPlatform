'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { PageTransition } from '@/components/layout/page-transition';
import { PassportForm } from '@/components/passports/passport-form';
import { PageHeader } from '@/components/ui/surface';
import { RequirePermission } from '@/components/auth/require-permission';

export default function NewPassportPage() {
  return (
    <PageTransition>
      <PageHeader
        eyebrow={
          <Link
            href="/passports"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Passports
          </Link>
        }
        title="New battery passport"
        description="All fields are required unless marked otherwise."
      />
      <RequirePermission
        permission="passport:create"
        description="Only administrators and developers can create or edit battery passports."
      >
        <PassportForm />
      </RequirePermission>
    </PageTransition>
  );
}
