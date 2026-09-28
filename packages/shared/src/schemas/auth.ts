import { z } from 'zod';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  role: z.enum(ROLES, { error: "Role must be either 'admin' or 'user'" }).default('user'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface UserDto extends AuthUser {
  createdAt: string;
  updatedAt: string;
}

export interface LoginResult {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthUser;
}
