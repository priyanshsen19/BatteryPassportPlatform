import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-surface', className)} {...props} />;
}

interface SectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Titled card used for detail sections and form groups. */
export function Section({ title, description, actions, children, className, id }: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <Card className={className}>
      <section aria-labelledby={headingId}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={headingId} className="text-sm font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          {actions}
        </header>
        <div className="p-5">{children}</div>
      </section>
    </Card>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-line/70', className)} aria-hidden {...props} />;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-line bg-subtle text-ink-muted [&_svg]:size-5">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Could not load data', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-[13px] font-medium text-accent underline-offset-4 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <div className="mt-1 text-[13px] text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
