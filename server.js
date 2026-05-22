import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const root = resolve(projectRoot, "dist");
const port = Number(process.env.PORT || 4174);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function loadEnv() {
  try {
    const env = await readFile(resolve(projectRoot, ".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional in hosted environments that provide env vars directly.
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function proxyFixtures(request, response) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    sendJson(response, 500, { error: "API_FOOTBALL_KEY is not configured on the server." });
    return;
  }

  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
  const date = requestUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const timezone = requestUrl.searchParams.get("timezone") || "Africa/Lagos";
  const providerUrl = new URL("https://v3.football.api-sports.io/fixtures");
  providerUrl.searchParams.set("date", date);
  providerUrl.searchParams.set("timezone", timezone);

  const providerResponse = await fetch(providerUrl, {
    headers: { "x-apisports-key": apiKey },
  });
  const body = await providerResponse.text();
  response.writeHead(providerResponse.status, {
    "Content-Type": providerResponse.headers.get("content-type") || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function getPublicConfig(response) {
  sendJson(response, 200, {
    hasContract: Boolean(process.env.GENLAYER_CONTRACT_ADDRESS),
    defaultNetwork: process.env.GENLAYER_NETWORK || "studionet",
  });
}

function getPrivateContractAddress() {
  return process.env.GENLAYER_CONTRACT_ADDRESS || "";
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = resolve(root, pathname.slice(1));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(file);
  } catch {
    const fallback = await readFile(resolve(root, "index.html"));
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(fallback);
  }
}

await loadEnv();

createServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/fixtures")) {
      await proxyFixtures(request, response);
      return;
    }
    if (request.url?.startsWith("/api/config")) {
      getPublicConfig(response);
      return;
    }
    if (request.url?.startsWith("/api/contract-address")) {
      const address = getPrivateContractAddress();
      if (!address) {
        sendJson(response, 500, { error: "GENLAYER_CONTRACT_ADDRESS is not configured." });
        return;
      }
      sendJson(response, 200, { address });
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`FinalWhistle server running at http://127.0.0.1:${port}/`);
});
