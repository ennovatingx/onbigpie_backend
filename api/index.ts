import "dotenv/config";
import { createApp } from "../server/app";

const appPromise = createApp("none").then(({ app }) => app);

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
