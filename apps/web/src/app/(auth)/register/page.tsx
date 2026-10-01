'use client';

import { registerSchema } from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthFormError } from '@/components/auth/auth-form-error';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
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
import { cn } from '@/lib/utils';

const ACCOUNT_TYPES = [
  { value: 'user', label: 'User', description: 'Read access', icon: User },
  { value: 'admin', label: 'Admin', description: 'Needs an access code', icon: ShieldCheck },
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]['value'];

const SIGN_UP_STEPS: PendingStep[] = [
  { after: 0, text: 'Creating your account…' },
  { after: 4, text: 'Saving your details securely…' },
  { after: 10, text: 'Waking up the platform…' },
  { after: 20, text: 'Preparing your dashboard…' },
  { after: 35, text: 'Almost there…' },
];

const ADMIN_SIGN_UP_STEPS: PendingStep[] = [
  { after: 0, text: 'Checking your access code…' },
  { after: 4, text: 'Creating your admin account…' },
  { after: 10, text: 'Waking up the platform…' },
  { after: 20, text: 'Preparing your dashboard…' },
  { after: 35, text: 'Almost there…' },
];

const formSchema = registerSchema
  .pick({ email: true, password: true })
  .extend({
    accountType: z.enum(['user', 'admin']),
    accessCode: z.string().trim().max(200, 'The access code is too long'),
  })
  .refine((values) => values.accountType !== 'admin' || values.accessCode.length > 0, {
    path: ['accessCode'],
    message: 'Enter the access code',
  });

type FormValues = z.infer<typeof formSchema>;

function wrongCodeMessage(err: ApiError): string {
  const left = err.remainingAttempts;
  if (left === undefined) return 'Wrong access code.';
  if (left === 0) return 'Wrong access code. No attempts left for now.';
  return `Wrong access code. ${left} attempt${left === 1 ? '' : 's'} left.`;
}

function AccountTypePicker({
  value,
  onChange,
}: {
  value: AccountType;
  onChange: (value: AccountType) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-2">
      {ACCOUNT_TYPES.map(({ value: option, label, description, icon: Icon }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
            value === option
              ? 'border-accent bg-accent-soft text-accent-ink'
              : 'border-line-strong text-ink hover:bg-subtle',
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="block text-[13px] font-medium">{label}</span>
            <span className="block text-xs text-ink-muted">{description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string>();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '', accountType: 'user', accessCode: '' },
  });
  const accountType = watch('accountType');
  const pendingMessage = usePendingMessage(
    isSubmitting,
    accountType === 'admin' ? ADMIN_SIGN_UP_STEPS : SIGN_UP_STEPS,
  );

  const chooseAccountType = (value: AccountType) => {
    setValue('accountType', value);
    clearErrors('accessCode');
  };

  const onSubmit = async ({ email, password, accountType, accessCode }: FormValues) => {
    setFormError(undefined);
    const isAdmin = accountType === 'admin';

    // Check the code first, so a wrong code never creates an account.
    if (isAdmin) {
      try {
        await authApi.verifyAccessCode(accessCode);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'INVALID_ACCESS_CODE') {
          setError('accessCode', { message: wrongCodeMessage(err) });
        } else if (err instanceof ApiError && err.status === 429) {
          setError('accessCode', { message: err.message });
        } else {
          setFormError(err instanceof ApiError ? err.message : 'The access code could not be checked.');
        }
        return;
      }
    }

    try {
      await authApi.register({ email, password, ...(isAdmin && { accessCode }) });
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

  const accessCodeHint = 'Provided by the platform owner.';

  return (
    <Card className="p-6 sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Create an account</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Users can view passports and documents. Admins manage everything, including roles.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4" noValidate>
        <AuthFormError message={formError} />
        <AccountTypePicker value={accountType} onChange={chooseAccountType} />
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
        {accountType === 'admin' && (
          <Field id="accessCode" label="Access code" error={errors.accessCode?.message} hint={accessCodeHint}>
            <Input
              type="password"
              autoComplete="off"
              invalid={!!errors.accessCode}
              {...fieldAria('accessCode', errors.accessCode?.message, accessCodeHint)}
              {...register('accessCode')}
            />
          </Field>
        )}
        <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
          {pendingMessage ? (
            <PendingLabel text={pendingMessage} />
          ) : accountType === 'admin' ? (
            'Create admin account'
          ) : (
            'Create account'
          )}
        </Button>
        <SlowStartNote active={isSubmitting} />
      </form>

      {accountType === 'user' && <GoogleSignIn />}

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
