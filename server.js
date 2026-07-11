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


// Without a cache, every browser polling this proxy burns a fresh upstream
// call against whatever quota this RapidAPI plan allows — share one upstream
// call across all local requests within the TTL window instead of one per poll.
const SOFASCORE_CACHE_TTL_MS = 50_000;
let sofascoreCache = null; // { body, status, contentType, expiresAt }
const SOFASCORE_RAPIDAPI_HOST = "sofascore.p.rapidapi.com";

async function proxySofaScore(response) {
  const apiKey = process.env.SOFASCORE_RAPIDAPI_KEY;
  if (!apiKey) {
    sendJson(response, 500, { error: "SOFASCORE_RAPIDAPI_KEY is not configured on the server." });
    return;
  }

  if (sofascoreCache && sofascoreCache.expiresAt > Date.now()) {
    response.writeHead(sofascoreCache.status, {
      "Content-Type": sofascoreCache.contentType,
      "Cache-Control": "public, max-age=45",
      "X-Content-Type-Options": "nosniff",
      "X-Cache": "HIT",
    });
    response.end(sofascoreCache.body);
    return;
  }

  const providerUrl = new URL(`https://${SOFASCORE_RAPIDAPI_HOST}/tournaments/get-live-events`);
  providerUrl.searchParams.set("sport", "football");

  const providerResponse = await fetch(providerUrl, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": SOFASCORE_RAPIDAPI_HOST,
    },
  });
  const body = await providerResponse.text();
  const contentType = providerResponse.headers.get("content-type") || "application/json; charset=utf-8";

  if (providerResponse.ok) {
    sofascoreCache = {
      body,
      status: providerResponse.status,
      contentType,
      expiresAt: Date.now() + SOFASCORE_CACHE_TTL_MS,
    };
  }

  response.writeHead(providerResponse.status, {
    "Content-Type": contentType,
    "Cache-Control": providerResponse.status === 429 ? "no-store" : "public, max-age=45",
    "X-Content-Type-Options": "nosniff",
    "X-Cache": "MISS",
  });
  response.end(body);
}

async function proxyTeamLogo(request, response) {
  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
  const teamId = requestUrl.searchParams.get("teamId");
  if (!teamId || !/^\d+$/.test(teamId)) {
    response.writeHead(400, { "Content-Type": "text/plain" });
    response.end("Missing or invalid teamId");
    return;
  }

  try {
    const providerResponse = await fetch(`https://api.sofascore.com/api/v1/team/${teamId}/image`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.sofascore.com/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    const contentType = providerResponse.headers.get("content-type") || "";
    if (!providerResponse.ok || !contentType.startsWith("image/")) {
      response.writeHead(providerResponse.ok ? 502 : providerResponse.status, { "Content-Type": "text/plain" });
      response.end("Logo not available");
      return;
    }
    const buffer = Buffer.from(await providerResponse.arrayBuffer());
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800, immutable",
    });
    response.end(buffer);
  } catch (error) {
    response.writeHead(502, { "Content-Type": "text/plain" });
    response.end(error.message || "Failed to fetch logo");
  }
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
    if (request.url?.startsWith("/api/sofascore-live")) {
      await proxySofaScore(response);
      return;
    }
    if (request.url?.startsWith("/api/team-logo")) {
      await proxyTeamLogo(request, response);
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
