export async function handler() {
  const address = process.env.GENLAYER_CONTRACT_ADDRESS;
  if (!address) {
    return json(500, { error: "GENLAYER_CONTRACT_ADDRESS is not configured." });
  }

  return json(200, { address });
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
