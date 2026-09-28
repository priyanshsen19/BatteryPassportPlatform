import { ROLES, type Role, type UserDto } from '@bpp/shared';
import { Schema, model, type HydratedDocument } from 'mongoose';

export interface UserAttributes {
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // Excluded from queries by default; only loaded explicitly for password checks
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'user' },
  },
  { timestamps: true, collection: 'users' },
);

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
