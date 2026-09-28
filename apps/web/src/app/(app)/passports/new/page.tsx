'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { PageTransition } from '@/components/layout/page-transition';
import { PassportForm } from '@/components/passports/passport-form';
import { PageHeader } from '@/components/ui/surface';
import { AdminOnly } from '@/components/passports/admin-only';

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
      <AdminOnly>
        <PassportForm />
      </AdminOnly>
    </PageTransition>
  );
}
