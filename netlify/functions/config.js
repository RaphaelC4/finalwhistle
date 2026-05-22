export async function handler() {
  return json(200, {
    hasContract: Boolean(process.env.GENLAYER_CONTRACT_ADDRESS),
    defaultNetwork: process.env.GENLAYER_NETWORK || "studionet",
  });
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
