import { Router } from "express";
import {register, login, loginWithPublicKey, verify} from "./controller";

export const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/login/pubkey", loginWithPublicKey);
authRoutes.get("/verify", verify);
