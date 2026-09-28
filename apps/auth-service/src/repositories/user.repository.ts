import type { Role } from '@bpp/shared';
import { UserModel, type UserDocument } from '../models/user.model';

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
};
