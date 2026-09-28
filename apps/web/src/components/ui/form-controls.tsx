import * as LabelPrimitive from '@radix-ui/react-label';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-subtle';

const borderFor = (invalid?: boolean) =>
  invalid ? 'border-danger focus-visible:outline-danger' : 'border-line-strong hover:border-ink-subtle';

type InputProps = ComponentProps<'input'> & { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(controlBase, 'h-9', borderFor(invalid), className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

type SelectProps = ComponentProps<'select'> & { invalid?: boolean };

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(controlBase, 'h-9 appearance-none pr-9', borderFor(invalid), className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-[13px] font-medium text-ink', className)} {...props} />;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label, control, hint and error message wired together for screen readers. */
export function Field({ id, label, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-ink-subtle" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria attributes for a control rendered inside <Field>. */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
