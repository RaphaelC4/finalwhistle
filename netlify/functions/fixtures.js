export async function handler(event) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return json(500, { error: "API_FOOTBALL_KEY is not configured." });
  }

  const params = event.queryStringParameters || {};
  const date = params.date || new Date().toISOString().slice(0, 10);
  const timezone = params.timezone || "Africa/Lagos";
  const providerUrl = new URL("https://v3.football.api-sports.io/fixtures");
  providerUrl.searchParams.set("date", date);
  providerUrl.searchParams.set("timezone", timezone);

  try {
    const response = await fetch(providerUrl, {
      headers: { "x-apisports-key": apiKey },
    });
    const body = await response.text();
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
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
