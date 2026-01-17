import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { UserRepository } from "./repository bakup";
import { User } from "./types";
import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || "DEV_SECRET_CHANGE_IN_PROD";

export class AuthService {
  constructor(private repo = new UserRepository()) {}

  async register(data: any): Promise<User> {
    const uuid = uuidv4();

    const user: User = {
      uuid,
      email: data.email,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 10)
        : undefined,
      publicKey: data.publicKey,
      publicName: data.publicName || "anon",
      avatarUrl: data.avatarUrl,
      role: "user",
      status: "active"
    };

    await this.repo.create(user);
    return user;
  }

  async login(data: any) {
    if (data.publicKey && data.signature) {
      return this.loginWithPublicKey(data);
    }

    const user = await this.repo.findByEmail(data.email);
    if (!user || !user.passwordHash) throw new Error("INVALID_CREDENTIALS");

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new Error("INVALID_CREDENTIALS");

    const token = jwt.sign({ uuid: user.uuid }, SECRET, { expiresIn: "1h" });
    return { token, user: this.sanitizeUser(user) };
  }

  async loginWithPublicKey(data: any) {
    const { publicKey, signature, challenge } = data;

    if (!publicKey || !signature) {
      throw new Error("MISSING_PUBKEY_OR_SIGNATURE");
    }

    const isValid = crypto.verify(
      "sha256",
      Buffer.from(challenge || "default-auth-challenge"),
      publicKey,
      Buffer.from(signature, "hex")
    );

    if (!isValid) throw new Error("INVALID_SIGNATURE");

    let user = await this.repo.findByPublicKey(publicKey);

    if (!user) {
      user = await this.repo.create({
        uuid: uuidv4(),
        publicKey,
        publicName: "anon-" + publicKey.slice(0, 8),
        role: "user",
        status: "active"
      });
    }

    const token = jwt.sign({ uuid: user.uuid }, SECRET, { expiresIn: "1h" });
    return { token, user: this.sanitizeUser(user) };
  }

  async verifyToken(token: string) {
    if (!token) throw new Error("NO_TOKEN_PROVIDED");

    const decoded: any = jwt.verify(token, SECRET);
    const user = await this.repo.findByUUID(decoded.uuid);
    if (!user) throw new Error("INVALID_TOKEN");

    return {
      uuid: user.uuid,
      public_name: user.publicName,
      avatar_url: user.avatarUrl || null,
      role: user.role,
      status: user.status
    };
  }

  private sanitizeUser(user: User) {
    return {
      uuid: user.uuid,
      publicName: user.publicName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status
    };
  }
}