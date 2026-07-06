// Module-level cache: persists across warm invocations of the same function
// instance. Without this, every visitor's browser triggers its own fresh
// upstream call — combined with a 60s client poll interval, one browser tab
// alone burns through API-Football's free-plan 100-requests/day quota in
// under two hours, and multiple visitors exhaust it far faster. Once the
// quota's gone, every visitor silently falls back to the scoreless SportSRC
// feed for the rest of the day. A shared cache means N visitors within the
// same ~50s window cost 1 upstream call, not N.
const CACHE_TTL_MS = 50_000;
const cache = new Map(); // key -> { body, status, contentType, expiresAt }

export async function handler(event) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return json(500, { error: "API_FOOTBALL_KEY is not configured." });
  }

  const params = event.queryStringParameters || {};
  const date = params.date || new Date().toISOString().slice(0, 10);
  const timezone = params.timezone || "Africa/Lagos";
  const cacheKey = `${date}:${timezone}`;

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

  const providerUrl = new URL("https://v3.football.api-sports.io/fixtures");
  providerUrl.searchParams.set("date", date);
  providerUrl.searchParams.set("timezone", timezone);

  try {
    const response = await fetch(providerUrl, {
      headers: { "x-apisports-key": apiKey },
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";

    // Only cache genuine successes — don't lock in a 429/5xx for 50 seconds.
    if (response.ok) {
      cache.set(cacheKey, { body, status: response.status, contentType, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": contentType,
        // Public + max-age lets Netlify's own edge CDN also cache and serve
        // repeat requests without invoking this function at all — the
        // in-memory cache above only helps if the same lambda instance is
        // reused, this helps regardless.
        "Cache-Control": response.status === 429 ? "no-store" : "public, max-age=45",
        "X-Content-Type-Options": "nosniff",
        "X-Cache": "MISS",
      },
      body,
    };
  } catch (error) {
    return json(500, { error: error.message || "Failed to load fixtures." });
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
