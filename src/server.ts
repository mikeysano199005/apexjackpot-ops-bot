import express, { Request, Response, NextFunction } from "express";
import { Client } from "discord.js";
import { config } from "./config";
import { handleEvent } from "./handlers";

export function createServer(client: Client) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime(), env: config.environment });
  });

  function verifySecret(req: Request, res: Response, next: NextFunction) {
    const secret = req.headers["x-bot-secret"];
    if (!secret || secret !== config.botSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  }

  app.post("/event", verifySecret, async (req: Request, res: Response) => {
    const { type, payload } = req.body;
    if (!type) { res.status(400).json({ error: "Missing event type" }); return; }

    res.json({ ok: true });

    setImmediate(async () => {
      try {
        await handleEvent(client, { type: type as any, payload: payload ?? {} });
      } catch (err) {
        console.error(`[server] Error routing event ${type}:`, err);
      }
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[server] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export function startServer(client: Client) {
  const app = createServer(client);
  const port = config.port;
  app.listen(port, () => console.log(`[server] Listening on port ${port}`));
}
