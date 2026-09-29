'use client';

import type { PassportDto } from '@bpp/shared/schemas';
import { motion } from 'framer-motion';
import { ArrowUpRight, BatteryCharging } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';
import { StatusBadge } from './passport-badges';
import { CopyLinkButton, PassportQr, usePassportUrl } from './passport-qr';

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className={`mt-1 truncate text-sm text-ink ${mono ? 'font-mono text-[13px]' : ''}`}>{children}</dd>
    </div>
  );
}

/** The battery shown as a digital passport card: key identity data with a scannable QR code. */
export function PassportHeroCard({ passport }: { passport: PassportDto }) {
  const info = passport.data.generalInformation;
  const materials = passport.data.materialComposition;
  const carbon = passport.data.carbonFootprint;
  const url = usePassportUrl(passport.id);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      aria-label={`Battery passport ${info.batteryIdentifier}`}
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-raised"
    >
      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden bg-brand px-5 py-4 text-brand-ink sm:px-6">
        <BatteryCharging
          className="pointer-events-none absolute -top-6 -right-4 size-32 rotate-12 text-white/15"
          aria-hidden
        />
        <div className="relative min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
            Digital battery passport
          </p>
          <p className="mt-0.5 truncate font-mono text-xl font-semibold tracking-tight sm:text-2xl">
            {info.batteryIdentifier}
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <span className="rounded-full bg-white/85 px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
            {info.batteryCategory}
          </span>
          <StatusBadge status={info.batteryStatus} className="bg-surface" />
        </div>
      </header>

      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:p-6">
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
          <Field label="Model">{info.batteryModel.modelName}</Field>
          <Field label="Manufacturer">{info.manufacturerInformation.manufacturerName}</Field>
          <Field label="Chemistry">{materials.batteryChemistry}</Field>
          <Field label="Mass">{formatNumber(info.batteryMass)} kg</Field>
          <Field label="Manufactured">{formatDate(info.manufacturingDate)}</Field>
          <Field label="Carbon footprint">
            {formatNumber(carbon.totalCarbonFootprint)} {carbon.measurementUnit}
          </Field>
        </dl>

        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-2">
          <PassportQr passportId={passport.id} identifier={info.batteryIdentifier} />
          <div className="flex flex-col gap-2 sm:items-center">
            <span className="text-xs text-ink-subtle">Scan to open</span>
            <CopyLinkButton url={url} className="sm:hidden" />
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-dashed border-line bg-subtle/50 px-5 py-2.5 text-xs text-ink-subtle sm:px-6">
        <span>Updated {formatDateTime(passport.updatedAt)}</span>
      </footer>
    </motion.article>
  );
}

/** Compact passport card for grid layouts. */
export function PassportTile({ passport, index = 0 }: { passport: PassportDto; index?: number }) {
  const info = passport.data.generalInformation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03, ease: 'easeOut' }}
    >
      <Link
        href={`/passports/${passport.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
      >
        <div className="flex items-center justify-between gap-2 bg-brand px-4 py-2.5 text-brand-ink">
          <span className="truncate font-mono text-sm font-semibold">{info.batteryIdentifier}</span>
          <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold">
            {info.batteryCategory}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{info.batteryModel.modelName}</p>
            <p className="truncate text-xs text-ink-muted">{info.manufacturerInformation.manufacturerName}</p>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <StatusBadge status={info.batteryStatus} />
            <span className="text-xs text-ink-subtle tabular-nums">{formatDate(info.manufacturingDate)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-subtle">
          <span>
            {formatNumber(passport.data.carbonFootprint.totalCarbonFootprint)}{' '}
            {passport.data.carbonFootprint.measurementUnit}
          </span>
          <ArrowUpRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
            aria-hidden
          />
        </div>
      </Link>
    </motion.div>
  );
}
