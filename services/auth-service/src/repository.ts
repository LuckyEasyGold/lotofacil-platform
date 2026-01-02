import { PrismaClient } from "@prisma/client";
import { User } from "./types";

const prisma = new PrismaClient();

export class UserRepository {
  async create(user: User) {
    return prisma.user.create({ data: user });
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
