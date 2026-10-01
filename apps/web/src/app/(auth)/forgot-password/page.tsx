'use client';

import { forgotPasswordSchema, type ForgotPasswordInput } from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthFormError } from '@/components/auth/auth-form-error';
import { SlowStartNote } from '@/components/auth/pending-status';
import { Button } from '@/components/ui/button';
import { Field, Input, fieldAria } from '@/components/ui/form-controls';
import { Card } from '@/components/ui/surface';
import { ApiError, authApi } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setFormError(undefined);
    try {
      await authApi.forgotPassword(values);
      setSentTo(values.email);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'The request failed. Please try again.');
    }
  };

  if (sentTo) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">Check your email</h1>
        <p className="mt-1 text-[13px] text-ink-muted" role="status">
          If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we sent a link to
          reset its password. The link expires soon and works once.
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setSentTo(undefined)}>
          Use a different email
        </Button>
        <p className="mt-6 text-center text-[13px] text-ink-muted">
          <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Enter your account email and we&apos;ll send you a link to choose a new password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4" noValidate>
        <AuthFormError message={formError} />
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            invalid={!!errors.email}
            {...fieldAria('email', errors.email?.message)}
            {...register('email')}
          />
        </Field>
        <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
          {isSubmitting ? 'Sending link…' : 'Send reset link'}
        </Button>
        <SlowStartNote active={isSubmitting} />
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
