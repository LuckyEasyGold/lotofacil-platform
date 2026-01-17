import { PrismaClient } from '@prisma/client/edge'
import { User } from './types';

const prisma = new PrismaClient()

export class UserRepository {
  async create(user: User) {
    return prisma.user.create({
      data: {
        uuid: user.uuid,
        email: user.email,
        passwordHash: user.passwordHash,
        publicName: user.publicName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        publicKey: user.publicKey,
      }
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByUUID(uuid: string) {
    return prisma.user.findUnique({ where: { uuid } });
  }

  async findByPublicKey(publicKey: string) {
    return prisma.user.findUnique({ where: { publicKey } });
  }
}