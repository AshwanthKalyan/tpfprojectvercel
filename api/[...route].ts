import "dotenv/config";
import { attachErrorHandler, createApp } from "../server/app";

const appPromise = createApp().then(({ app }) => {
  attachErrorHandler(app);
  return app;
});

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
