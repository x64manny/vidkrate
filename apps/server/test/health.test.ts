import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  const app = buildApp();

  after(async () => {
    (await app).close();
  });

  it("returns 200 with status ok", async () => {
    const server = await app;
    const response = await server.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });
});
