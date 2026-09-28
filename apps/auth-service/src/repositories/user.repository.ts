import type { Role } from '@bpp/shared';
import { UserModel, type UserDocument } from '../models/user.model';

export const userRepository = {
  async existsByEmail(email: string): Promise<boolean> {
    return (await UserModel.exists({ email })) !== null;
  },

  create(data: { email: string; passwordHash: string; role: Role }): Promise<UserDocument> {
    return UserModel.create(data);
  },

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).select('+passwordHash').exec();
  },

  findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  },
};
