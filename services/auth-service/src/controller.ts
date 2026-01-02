import { Request, Response } from "express";
import { AuthService } from "./service";

const service = new AuthService();

export async function register(req: Request, res: Response) {
  res.json(await service.register(req.body));
}

export async function login(req: Request, res: Response) {
  res.json(await service.login(req.body));
}

export async function verify(req: Request, res: Response) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });

  res.json(await service.verifyToken(token));
}
export async function loginWithPubKey(req: Request, res: Response) {
  res.json(await service.loginWithPublicKey(req.body));
}

