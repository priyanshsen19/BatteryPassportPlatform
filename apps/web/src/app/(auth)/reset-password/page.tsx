'use client';

import { resetPasswordSchema } from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthFormError } from '@/components/auth/auth-form-error';
import { SlowStartNote } from '@/components/auth/pending-status';
import { Button } from '@/components/ui/button';
import { Field, Input, fieldAria } from '@/components/ui/form-controls';
import { Card } from '@/components/ui/surface';
import { ApiError, authApi } from '@/lib/api-client';

const formSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof formSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const token = params.get('token') ?? '';
  const [formError, setFormError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ password }: FormValues) => {
    setFormError(undefined);
    try {
      await authApi.resetPassword({ token, password });
      queryClient.clear();
      router.replace('/login?reset=1');
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'The password could not be reset. Please try again.',
      );
    }
  };

  if (!token) {
    return (
      <Card className="p-6 sm:p-7">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Reset link missing</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Open the link from your email, or request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex font-medium text-[13px] text-accent underline-offset-4 hover:underline"
        >
          Request a new link
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Choose a new password</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        You&apos;ll be signed out everywhere and can sign in with the new password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4" noValidate>
        <AuthFormError message={formError} />
        <Field
          id="password"
          label="New password"
          error={errors.password?.message}
          hint="At least 8 characters."
        >
          <Input
            type="password"
            autoComplete="new-password"
            autoFocus
            invalid={!!errors.password}
            {...fieldAria('password', errors.password?.message, 'At least 8 characters.')}
            {...register('password')}
          />
        </Field>
        <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            {...fieldAria('confirmPassword', errors.confirmPassword?.message)}
            {...register('confirmPassword')}
          />
        </Field>
        <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
          {isSubmitting ? 'Updating password…' : 'Update password'}
        </Button>
        <SlowStartNote active={isSubmitting} />
      </form>

      {formError && (
        <p className="mt-6 text-center text-[13px] text-ink-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
