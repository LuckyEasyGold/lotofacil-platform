import { User } from './types';

export class UserRepository {
  private users: User[] = [];

  async create(user: User): Promise<User> {
    this.users.push(user);
    console.log('✅ Usuário criado em memória:', user.email || user.publicKey?.slice(0, 8));
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) || null;
  }

  async findByUUID(uuid: string): Promise<User | null> {
    return this.users.find(u => u.uuid === uuid) || null;
  }

  async findByPublicKey(publicKey: string): Promise<User | null> {
    return this.users.find(u => u.publicKey === publicKey) || null;
  }
}