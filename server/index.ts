import "dotenv/config";
import { attachErrorHandler, createApp, log } from "./app";
import { serveStatic } from "./static";
import { setupVite } from "./vite";

(async () => {
  try {
    const { app, httpServer } = await createApp();
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      serveStatic(app);
    } else {
      await setupVite(httpServer, app);
    }

    attachErrorHandler(app);

    const port = Number(process.env.PORT) || 5000;

    httpServer.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Startup Error:", error);
    process.exit(1);
  }
})();
