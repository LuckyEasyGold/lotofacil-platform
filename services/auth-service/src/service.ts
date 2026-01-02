import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { UserRepository } from "./repository";
import { User } from "./types";
import crypto from "crypto";

const SECRET = "DEV_SECRET";

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
      publicName: data.publicName || "anon",
      avatarUrl: data.avatarUrl,
      role: "user",
      status: "active"
    };

    await this.repo.create(user);
    return user;
  }

  async login(data: any) {
    const user = await this.repo.findByEmail(data.email);
    if (!user || !user.passwordHash) throw new Error("INVALID_CREDENTIALS");

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new Error("INVALID_CREDENTIALS");

    const token = jwt.sign({ uuid: user.uuid }, SECRET, { expiresIn: "1h" });
    return { token };
  }

  async verifyToken(token: string) {
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

  async loginWithPublicKey(data: any) {
  const { publicKey, signature, challenge } = data;

  const isValid = crypto.verify(
    "sha256",
    Buffer.from(challenge),
    publicKey,
    Buffer.from(signature, "hex")
  );

  if (!isValid) throw new Error("INVALID_SIGNATURE");

  let user = await this.repo.findByPublicKey(publicKey);

  if (!user) {
    user = await this.repo.create({
      uuid: uuidv4(),
      publicKey,
      publicName: "anon",
      role: "user",
      status: "active"
    });
  }

  const token = jwt.sign({ uuid: user.uuid }, SECRET, { expiresIn: "1h" });
  return { token };
}
}
