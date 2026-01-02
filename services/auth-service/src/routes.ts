import { Router } from "express";
import { register, login, verify } from "./controller";


export const authRoutes = Router();

authRoutes.post("/login/pubkey", loginWithPubKey);
authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.get("/verify", verify);
