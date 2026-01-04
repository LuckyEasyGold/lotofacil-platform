import { Router } from "express";
import {
  register,
  login,
  loginWithPubKey,  // ← NOME CORRETO
  verify
} from "./controller";

export const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/login/pubkey", loginWithPubKey);  // ← usa loginWithPubKey
authRoutes.get("/verify", verify);