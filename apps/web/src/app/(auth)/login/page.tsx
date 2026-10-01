'use client';

import { loginSchema, type LoginInput } from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthFormError } from '@/components/auth/auth-form-error';
import { GOOGLE_ERRORS, GoogleSignIn } from '@/components/auth/google-sign-in';
import {
  PendingLabel,
  SlowStartNote,
  usePendingMessage,
  type PendingStep,
} from '@/components/auth/pending-status';
import { Button } from '@/components/ui/button';
import { Field, Input, fieldAria } from '@/components/ui/form-controls';
import { Card } from '@/components/ui/surface';
import { ApiError, authApi } from '@/lib/api-client';

const SIGN_IN_STEPS: PendingStep[] = [
  { after: 0, text: 'Signing in…' },
  { after: 4, text: 'Verifying your credentials…' },
  { after: 10, text: 'Waking up the platform…' },
  { after: 20, text: 'Loading your dashboard…' },
  { after: 35, text: 'Almost there…' },
];

/** Only allow same-site relative redirects after login. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | undefined>(
    () => GOOGLE_ERRORS[params.get('error') ?? ''],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const pendingMessage = usePendingMessage(isSubmitting, SIGN_IN_STEPS);

  const onSubmit = async (values: LoginInput) => {
    setFormError(undefined);
    try {
      await authApi.login(values);
      queryClient.clear();
      router.replace(safeNext(params.get('next')));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Sign in failed. Please try again.');
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1 text-[13px] text-ink-muted">Access battery passports and their documents.</p>

      {params.get('reset') && !formError && (
        <p
          className="mt-4 rounded-md border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-muted"
          role="status"
        >
          Your password has been updated. Sign in with your new password.
        </p>
      )}

      {params.get('expired') && !params.get('reset') && !formError && (
        <p
          className="mt-4 rounded-md border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-muted"
          role="status"
        >
          Your session has ended. Please sign in again.
        </p>
      )}

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
        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...fieldAria('password', errors.password?.message)}
            {...register('password')}
          />
        </Field>
        <Link
          href="/forgot-password"
          className="-mt-2 self-end text-[13px] font-medium text-accent underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
          {pendingMessage ? <PendingLabel text={pendingMessage} /> : 'Sign in'}
        </Button>
        <SlowStartNote active={isSubmitting} />
      </form>

      <GoogleSignIn next={params.get('next') ?? undefined} />

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-accent underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
