import { PrismaClient, User as PrismaUser } from '@prisma/client';
import { User } from './types';

const prisma = new PrismaClient();

// Converter entre nosso tipo User e PrismaUser
function toPrismaUser(data: User): Partial<PrismaUser> {
  return {
    uuid: data.uuid,
    email: data.email || null,
    passwordHash: data.passwordHash || null,
    publicName: data.publicName,
    avatarUrl: data.avatarUrl || null,
    role: data.role,
    status: data.status,
    publicKey: data.publicKey || null,
  };
}

function fromPrismaUser(prismaUser: PrismaUser | null): User | null {
  if (!prismaUser) return null;
  
  return {
    uuid: prismaUser.uuid,
    email: prismaUser.email || undefined,
    passwordHash: prismaUser.passwordHash || undefined,
    publicKey: prismaUser.publicKey || undefined,
    publicName: prismaUser.publicName,
    avatarUrl: prismaUser.avatarUrl || undefined,
    role: prismaUser.role as "user" | "contributor" | "admin",
    status: prismaUser.status as "active" | "blocked",
  };
}

export class UserRepository {
  async create(user: User): Promise<User> {
    const prismaUser = await prisma.user.create({
      data: toPrismaUser(user) as any,
    });
    return fromPrismaUser(prismaUser)!;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return fromPrismaUser(user);
  }

  async findByUUID(uuid: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { uuid } });
    return fromPrismaUser(user);
  }

  async findByPublicKey(publicKey: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { publicKey } });
    return fromPrismaUser(user);
  }
}