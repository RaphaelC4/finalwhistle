import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function apiProxyPlugin() {
  return {
    name: "api-proxy",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      const rapidApiKey = env.SOFASCORE_RAPIDAPI_KEY || process.env.SOFASCORE_RAPIDAPI_KEY || "";
      const contractAddress = env.GENLAYER_CONTRACT_ADDRESS || process.env.GENLAYER_CONTRACT_ADDRESS || "";
      const defaultNetwork = env.GENLAYER_NETWORK || process.env.GENLAYER_NETWORK || "studionet";

      const cache = new Map();
      const CACHE_TTL = 50_000;

      server.middlewares.use("/api/sofascore-live", async (req, res) => {
        if (!rapidApiKey) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "SOFASCORE_RAPIDAPI_KEY is not set in .env" }));
          return;
        }

        const cacheKey = "live-football";
        const cached = cache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          res.writeHead(200, { "Content-Type": "application/json", "X-Cache": "HIT" });
          res.end(cached.body);
          return;
        }

        try {
          const upstream = await fetch("https://sofascore.p.rapidapi.com/tournaments/get-live-events?sport=football", {
            headers: {
              "x-rapidapi-key": rapidApiKey,
              "x-rapidapi-host": "sofascore.p.rapidapi.com",
            },
          });
          const body = await upstream.text();
          if (upstream.ok) {
            cache.set(cacheKey, { body, expires: Date.now() + CACHE_TTL });
          }
          res.writeHead(upstream.status, { "Content-Type": "application/json", "X-Cache": "MISS" });
          res.end(body);
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/team-logo", async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const teamId = url.searchParams.get("teamId");
        if (!teamId || !/^\d+$/.test(teamId)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing or invalid teamId");
          return;
        }

        const logoCacheKey = `logo-${teamId}`;
        const cachedLogo = cache.get(logoCacheKey);
        if (cachedLogo && cachedLogo.expires > Date.now()) {
          res.writeHead(200, { "Content-Type": cachedLogo.contentType, "Cache-Control": "public, max-age=604800, immutable" });
          res.end(cachedLogo.body);
          return;
        }

        try {
          const upstream = await fetch(`https://api.sofascore.com/api/v1/team/${teamId}/image`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Referer: "https://www.sofascore.com/",
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
          });
          const contentType = upstream.headers.get("content-type") || "image/png";
          if (!upstream.ok || !contentType.startsWith("image/")) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Logo not available");
            return;
          }
          const buffer = Buffer.from(await upstream.arrayBuffer());
          cache.set(logoCacheKey, { body: buffer, contentType, expires: Date.now() + 604800000 });
          res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=604800, immutable" });
          res.end(buffer);
        } catch (err) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(err.message);
        }
      });

      server.middlewares.use("/api/config", (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ hasContract: Boolean(contractAddress), defaultNetwork }));
      });

      server.middlewares.use("/api/contract-address", (req, res) => {
        if (!contractAddress) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "GENLAYER_CONTRACT_ADDRESS is not configured." }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ address: contractAddress }));
      });
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [apiProxyPlugin()],
});
