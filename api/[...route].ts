import "dotenv/config";
import { attachErrorHandler, createApp } from "../server/app";

const appPromise = createApp()
  .then(({ app }) => {
    attachErrorHandler(app);
    return app;
  })
  .catch((error) => {
    console.error("Failed to initialize app:", error);
    throw error;
  });

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        res.off?.("finish", onFinish);
        res.off?.("close", onClose);
      };

      const onFinish = () => {
        cleanup();
        resolve();
      };

      const onClose = () => {
        cleanup();
        resolve();
      };

      res.on?.("finish", onFinish);
      res.on?.("close", onClose);

      try {
        app(req, res, (error: unknown) => {
          cleanup();
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  } catch (error: any) {
    console.error("API handler error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: error?.message || "API handler failed",
      });
    }
  }
}
