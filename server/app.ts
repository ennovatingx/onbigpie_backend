import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes.ts";
import { serveStatic } from "./static.ts";

type ClientMode = "static" | "vite" | "none";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp(clientMode: ClientMode = "none") {
  const app = express();
  const httpServer: Server = createServer(app);

  app.use(
    cors({
      origin: [
        "http://localhost:5050",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://localhost:8001",
        "http://127.0.0.1:5050",
        "http://127.0.0.1:5000",
        "http://127.0.0.1:5173",
        "https://preview.rideralogistics.com",
        "https://www.preview.rideralogistics.com",
        "https://rideralogistics.com",
        "https:/www.rideralogistics.com",
        "https://onbigpie-backend.vercel.app"
      ],
      credentials: true,
    }),
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (res.headersSent) {
      return next(err);
    }

    console.error("Unhandled server error:", err);
    return res.status(status).json({ message });
  });

  if (clientMode === "static") {
    serveStatic(app);
  } else if (clientMode === "vite") {
    const { setupVite } = await import("./vite.ts");
    await setupVite(httpServer, app);
  }

  return { app, httpServer };
}
