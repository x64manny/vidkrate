export const env = {
  HOST: process.env.HOST ?? "0.0.0.0",
  PORT: Number(process.env.PORT ?? 3001),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
} as const;
