import { ROLES, type Role, type UserDto } from '@bpp/shared';
import { Schema, model, type HydratedDocument } from 'mongoose';

export interface UserAttributes {
  email: string;
  /** Absent for accounts that only sign in with Google. */
  passwordHash?: string;
  /** Google account id (`sub` claim), set once the account has signed in with Google. */
  googleId?: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // Excluded from queries by default; only loaded explicitly for password checks
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ROLES, required: true, default: 'user' },
  },
  { timestamps: true, collection: 'users' },
);

// Every account needs at least one way to sign in.
userSchema.pre('validate', function requireCredential() {
  if (this.isNew && !this.passwordHash && !this.googleId) {
    this.invalidate('passwordHash', 'A password or a Google account is required');
  }
});

export const UserModel = model<UserAttributes>('User', userSchema);

export function toUserDto(user: UserDocument): UserDto {
  return {
    id: user.id as string,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
