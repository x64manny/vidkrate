import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { progressRoutes } from "./routes/progress.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(process.env.NODE_ENV !== "production" && {
        transport: { target: "pino-pretty" },
      }),
    },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(websocket);

  await app.register(healthRoutes);
  await app.register(progressRoutes);

  return app;
}
