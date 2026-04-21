import "dotenv/config";
import { createApp, log } from "./app.ts";

async function main() {
  const clientMode = process.env.NODE_ENV === "production" ? "static" : "vite";
  const { httpServer } = await createApp(clientMode);

  const host = process.env.HOST || "127.0.0.1";
  const basePort = parseInt(process.env.PORT || "5000", 10);
  const maxTries = 10;

  function startServer(p: number, tries = 0) {
    const onError = (err: any) => {
      if (err?.code === "EADDRINUSE" && tries < maxTries) {
        const next = p + 1;
        log(`port ${p} in use, trying ${next}`);
        httpServer.off("error", onError);
        startServer(next, tries + 1);
        return;
      }
      throw err;
    };

    httpServer.once("error", onError);
    httpServer.listen(p, host, () => {
      httpServer.off("error", onError);
      log(`serving on port ${p}`);
    });
  }

  startServer(basePort);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

