'use client';

import { registerSchema, type RegisterInput } from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthFormError } from '@/components/auth/auth-form-error';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, fieldAria } from '@/components/ui/form-controls';
import { Card } from '@/components/ui/surface';
import { ApiError, authApi } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string>();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', role: 'user' },
  });

  const onSubmit = async (values: RegisterInput) => {
    setFormError(undefined);
    try {
      await authApi.register(values);
      queryClient.clear();
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_REGISTERED') {
        setError('email', { message: err.message });
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
      }
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Create an account</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Admins manage passports and documents; users have read access.
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
        <Field id="password" label="Password" error={errors.password?.message} hint="At least 8 characters.">
          <Input
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...fieldAria('password', errors.password?.message, 'At least 8 characters.')}
            {...register('password')}
          />
        </Field>
        <Field id="role" label="Role" error={errors.role?.message}>
          <Select invalid={!!errors.role} {...fieldAria('role', errors.role?.message)} {...register('role')}>
            <option value="user">User — view passports and documents</option>
            <option value="admin">Admin — manage passports and documents</option>
          </Select>
        </Field>
        <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <GoogleSignIn />

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
