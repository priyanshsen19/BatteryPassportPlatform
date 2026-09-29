import { z } from 'zod';

export const ROLES = ['admin', 'developer', 'tester', 'user'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Single source of truth for what each role may do; enforced by the services and mirrored by
 * the web UI. Accounts created in the web app or with Google start as `user`.
 */
export const PERMISSIONS = {
  'passport:read': ['admin', 'developer', 'tester', 'user'],
  'passport:create': ['admin', 'developer', 'tester'],
  'passport:update': ['admin', 'developer'],
  'passport:delete': ['admin'],
  'document:read': ['admin', 'developer', 'tester', 'user'],
  'document:upload': ['admin', 'developer', 'tester'],
  'document:update': ['admin', 'developer'],
  'document:delete': ['admin'],
  'user:manage': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access, including deleting records and managing user roles',
  developer: 'Create and edit passports, upload and rename documents',
  tester: 'Create passports and upload documents; no editing or deleting',
  user: 'Read-only access to passports and documents',
};

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

/** Registration body from the assignment: `role` is optional and defaults to `user`. */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  /** Optional, as in the assignment's register body; defaults to `user`. */
  role: z.enum(ROLES, { error: `Role must be one of: ${ROLES.join(', ')}` }).default('user'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Body of POST /api/auth/forgot-password. */
export const forgotPasswordSchema = z.object({ email: emailSchema });

/** Body of POST /api/auth/reset-password: the token from the emailed link and the new password. */
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'The reset link is invalid').max(256, 'The reset link is invalid'),
  password: passwordSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Body of POST /api/auth/google: a Google ID token obtained through OAuth. */
export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required').max(4096),
});

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface UserDto extends AuthUser {
  createdAt: string;
  updatedAt: string;
}

export const SIGN_IN_METHODS = ['password', 'google'] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/** A user as shown to administrators on the user roles page. */
export interface ManagedUserDto extends UserDto {
  signInMethods: SignInMethod[];
}

/** Query parameters of GET /api/auth/users (admin only). */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((value) => value || undefined),
  role: z.enum(ROLES).optional(),
});

/** Body of PATCH /api/auth/users/:id/role (admin only). */
export const updateUserRoleSchema = z.strictObject({
  role: z.enum(ROLES, { error: `Role must be one of: ${ROLES.join(', ')}` }),
});

export interface LoginResult {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthUser;
}
