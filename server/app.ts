import express, { type NextFunction, type Request, type Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { createServer } from "http";
import { registerRoutes } from "./routes";

export async function createApp() {
  const app = express();
  const httpServer = createServer(app);

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(clerkMiddleware());

  await registerRoutes(app);

  return { app, httpServer };
}

export function attachErrorHandler(app: express.Express) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server Error:", err);
    res.status(500).json({
      message: "Internal server error",
    });
  });
}

export function log(message: string) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message}`);
}
