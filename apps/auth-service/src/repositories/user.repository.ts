import type { Role } from '@bpp/shared';
import { UserModel, type UserDocument } from '../models/user.model';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const userRepository = {
  async existsByEmail(email: string): Promise<boolean> {
    return (await UserModel.exists({ email })) !== null;
  },

  create(data: {
    email: string;
    passwordHash?: string;
    googleId?: string;
    role: Role;
  }): Promise<UserDocument> {
    return UserModel.create(data);
  },

  findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).exec();
  },

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).select('+passwordHash').exec();
  },

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ googleId }).exec();
  },

  linkGoogleAccount(id: string, googleId: string): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { $set: { googleId } }, { new: true }).exec();
  },

  findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  },

  /** Lists users (password hashes are loaded only to report which sign-in methods exist). */
  async list(filter: { q?: string; role?: Role }, page: number, limit: number) {
    const query: Record<string, unknown> = {};
    if (filter.role) query.role = filter.role;
    if (filter.q) query.email = new RegExp(escapeRegex(filter.q), 'i');

    const [items, total] = await Promise.all([
      UserModel.find(query)
        .select('+passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  },

  setPasswordResetToken(id: string, tokenHash: string, expiresAt: Date): Promise<unknown> {
    return UserModel.updateOne(
      { _id: id },
      { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } },
    ).exec();
  },

  /** Consumes a valid, unexpired reset token and sets the new password in one atomic update. */
  resetPasswordWithToken(tokenHash: string, passwordHash: string): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate(
      { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
      {
        $set: { passwordHash, passwordChangedAt: new Date() },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
      },
      { new: true },
    ).exec();
  },

  updateRole(id: string, role: Role): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { $set: { role } }, { new: true, runValidators: true })
      .select('+passwordHash')
      .exec();
  },
};
