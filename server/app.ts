import express, { type NextFunction, type Request, type Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { createServer } from "http";
import { registerRoutes } from "./routes";

export async function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const clerk = clerkMiddleware();

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    try {
      const result = clerk(req, res, next);
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch((error) => {
          console.error("Clerk middleware error:", error);
          next();
        });
      }
    } catch (error) {
      console.error("Clerk middleware error:", error);
      next();
    }
  });

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
