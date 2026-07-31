export interface User {
  uuid: string;
  email?: string;
  passwordHash?: string;
  publicKey?: string;
  publicName: string;
  avatarUrl?: string;
  role: "user" | "contributor" | "admin";
  status: "active" | "blocked";
}
