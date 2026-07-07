// Proxies SofaScore's live football events through RapidAPI, keeping the
// RapidAPI key server-side (never exposed to the browser).
//
// NOTE on endpoint/params: this is built against the documented shape of the
// "apidojo" Sofascore API (host: sofascore.p.rapidapi.com) — specifically
// GET /tournaments/get-live-events, described as "List recent live events of
// specific sport". The exact query parameter name for selecting football
// (best guess: `sport=football`) hasn't been verified against a live,
// authenticated call. If this 400s, check the RapidAPI playground for this
// exact endpoint to confirm the parameter name/value and adjust below.
//
// Same reasoning as fixtures.js for caching: without it, every visitor's
// browser polling this proxy burns a fresh upstream call against whatever
// quota this RapidAPI plan allows.
const CACHE_TTL_MS = 50_000;
const cache = new Map(); // key -> { body, status, contentType, expiresAt }

const RAPIDAPI_HOST = "sofascore.p.rapidapi.com";

export async function handler() {
  const apiKey = process.env.SOFASCORE_RAPIDAPI_KEY;
  if (!apiKey) {
    return json(500, { error: "SOFASCORE_RAPIDAPI_KEY is not configured." });
  }

  const cacheKey = "live-football";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      statusCode: cached.status,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=45",
        "X-Content-Type-Options": "nosniff",
        "X-Cache": "HIT",
      },
      body: cached.body,
    };
  }

  const providerUrl = new URL(`https://${RAPIDAPI_HOST}/tournaments/get-live-events`);
  providerUrl.searchParams.set("sport", "football");

  try {
    const response = await fetch(providerUrl, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";

    if (response.ok) {
      cache.set(cacheKey, { body, status: response.status, contentType, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": response.status === 429 ? "no-store" : "public, max-age=45",
        "X-Content-Type-Options": "nosniff",
        "X-Cache": "MISS",
      },
      body,
    };
  } catch (error) {
    return json(500, { error: error.message || "Failed to load SofaScore events." });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}
