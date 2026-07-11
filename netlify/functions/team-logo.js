// SofaScore's team image CDN (api.sofascore.com/api/v1/team/{id}/image)
// returns 403 when the browser requests it directly (hotlink protection).
// Proxying it through our own server-side function works: the request is
// server-to-server here, not a cross-origin browser request, so SofaScore
// serves it normally. We then pass those bytes straight through to the
// browser as if they came from us.
export async function handler(event) {
  const teamId = event.queryStringParameters?.teamId;
  if (!teamId || !/^\d+$/.test(teamId)) {
    return { statusCode: 400, headers: { "Content-Type": "text/plain" }, body: "Missing or invalid teamId" };
  }

  try {
    const response = await fetch(`https://api.sofascore.com/api/v1/team/${teamId}/image`, {
      headers: {
        // SofaScore has tightened bot detection recently — a bare fetch with
        // no headers can get 403'd even server-to-server. These make the
        // request look like an ordinary browser visit.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.sofascore.com/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    const contentType = response.headers.get("content-type") || "";

    // A bot-detection challenge page comes back as text/html with a 200 or
    // 403 — either way, if it's not actually image bytes, don't pass it
    // through as one; let the frontend's onerror fallback take over instead.
    if (!response.ok || !contentType.startsWith("image/")) {
      return {
        statusCode: response.ok ? 502 : response.status,
        headers: { "Content-Type": "text/plain" },
        body: "Logo not available",
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        // Crests essentially never change — cache aggressively both at the
        // browser and at Netlify's edge CDN so repeat visitors/matches
        // reusing the same team don't hit this function or SofaScore again.
        "Cache-Control": "public, max-age=604800, immutable",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    return { statusCode: 502, headers: { "Content-Type": "text/plain" }, body: error.message || "Failed to fetch logo" };
  }
}
