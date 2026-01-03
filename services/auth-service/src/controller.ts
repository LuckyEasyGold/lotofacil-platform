import { Request, Response } from "express";
import { AuthService } from "./service";

const authService = new AuthService();

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error: any) {
    return res.status(401).json({ error: error.message });
  }
}

export async function loginWithPubKey(req: Request, res: Response) {
  try {
    const result = await authService.loginWithPublicKey(req.body);
    return res.json(result);
  } catch (error: any) {
    return res.status(401).json({ error: error.message });
  }
}

export async function verify(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "NO_TOKEN_PROVIDED" });
    }
    
    const result = await authService.verifyToken(token);
    return res.json(result);
  } catch (error: any) {
    return res.status(401).json({ error: error.message });
  }
}