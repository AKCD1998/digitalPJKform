import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const serverEntry = path.join(backendRoot, "src", "server.js");

let child;
let baseUrl;

function testEnv(extra = {}) {
  return {
    ...process.env,
    NODE_ENV: "test",
    PORT: "",
    DATABASE_URL: "",
    JWT_SECRET: "test-only-shared-secret",
    DIGITALPJK_DATABASE_URL: "",
    DIGITALPJK_JWT_SECRET: "test-only-digitalpjk-secret",
    DIGITALPJK_JWT_EXPIRES_IN: "1h",
    CORS_ORIGIN: "http://localhost:5173",
    DIGITALPJK_LOGIN_RATE_LIMIT_WINDOW_MS: "60000",
    DIGITALPJK_LOGIN_RATE_LIMIT_MAX: "5",
    DIGITALPJK_PDF_WRITE_SAMPLE: "false",
    DIGITALPJK_PDF_SAMPLE_DIR: "",
    ...extra,
  };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(process, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for backend to start. Output:\n${output}`));
    }, timeoutMs);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output);
    }

    process.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("Backend listening on")) {
        finish();
      }
    });

    process.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    process.on("error", finish);
    process.on("exit", (code) => {
      if (!settled) {
        finish(new Error(`Backend exited before startup with code ${code}. Output:\n${output}`));
      }
    });
  });
}

function stopServer(process) {
  return new Promise((resolve) => {
    if (!process || process.exitCode !== null || process.signalCode !== null) {
      resolve();
      return;
    }

    const fallback = setTimeout(resolve, 3000);
    process.once("exit", () => {
      clearTimeout(fallback);
      resolve();
    });
    process.kill();
  });
}

async function readJson(response) {
  return response.json();
}

before(async () => {
  const port = await getFreePort();
  child = spawn(process.execPath, [serverEntry], {
    cwd: backendRoot,
    env: testEnv({ PORT: String(port) }),
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForServer(child);
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await stopServer(child);
});

test("app, db layer, routes, controllers, middleware, and services import safely", () => {
  const script = `
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "";
    process.env.JWT_SECRET = "test-only-shared-secret";
    process.env.DIGITALPJK_DATABASE_URL = "";
    process.env.DIGITALPJK_JWT_SECRET = "test-only-digitalpjk-secret";
    await import("./src/app.js");
    await import("./src/db/pool.js");
    await import("./src/routes/auth.routes.js");
    await import("./src/routes/branches.routes.js");
    await import("./src/routes/documents.routes.js");
    await import("./src/routes/admin.routes.js");
    await import("./src/routes/pharmacists.js");
    await import("./src/controllers/auth.controller.js");
    await import("./src/controllers/documents.controller.js");
    await import("./src/middleware/auth.middleware.js");
    await import("./src/services/auth.service.js");
    await import("./src/services/branches.service.js");
    console.log("ok");
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: backendRoot,
    env: testEnv(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ok/);
});

test("health route returns the public baseline response", async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });
});

test("auth routes return baseline validation and auth failures", async () => {
  const missingCredentials = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(missingCredentials.status, 400);
  assert.deepEqual(await readJson(missingCredentials), {
    error: "username and password are required.",
  });

  const me = await fetch(`${baseUrl}/api/me`);
  assert.equal(me.status, 401);
  assert.deepEqual(await readJson(me), {
    error: "Missing or invalid Authorization header.",
  });
});

test("protected resource routes reject unauthenticated requests before database work", async () => {
  const cases = [
    ["GET", "/api/branches"],
    ["GET", "/api/branches/not-a-uuid"],
    ["GET", "/api/admin/settings"],
    ["PUT", "/api/admin/settings"],
    ["GET", "/api/documents/recent"],
    ["GET", "/api/documents/debug-grid"],
    ["GET", "/api/documents/not-a-uuid"],
    ["POST", "/api/documents/generate"],
    ["POST", "/api/documents/generate-merged"],
    ["GET", "/api/pharmacists/part-time"],
  ];

  for (const [method, route] of cases) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" || method === "PUT" ? JSON.stringify({}) : undefined,
    });

    assert.equal(response.status, 401, `${method} ${route}`);
    assert.deepEqual(await readJson(response), {
      error: "Missing or invalid Authorization header.",
    });
  }
});

test("unknown routes return JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-real-route`);

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), { error: "Not found" });
});
