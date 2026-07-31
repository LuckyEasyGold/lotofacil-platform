import express from "express";
import { authRoutes } from "./routes";

export function startServer() {
  const app = express();
  app.use(express.json());

  app.use("/auth", authRoutes);

  const port = 3001;
  app.listen(port, () => {
    console.log(`Auth Service rodando na porta ${port}`);
  });
}
