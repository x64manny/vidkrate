import type { FastifyPluginAsync } from "fastify";

export const progressRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ws/progress", { websocket: true }, (socket) => {
    socket.on("message", (raw: Buffer | string) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      app.log.info({ msg: "ws:message", data: text });
    });

    socket.on("close", () => {
      app.log.info("ws:closed");
    });
  });
};
