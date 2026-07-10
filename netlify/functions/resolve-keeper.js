// Scheduled keeper: automatically calls resolve() on the configured
// FinalWhistleResolver market once its game_date has passed, so bets don't
// sit "pending" forever waiting for someone to manually click Resolve.
//
// Runs every 30 minutes (see `config.schedule` below). Needs its own signer
// — a dedicated "keeper" wallet, funded with GEN test tokens on studionet —
// because there's no human in the loop to approve a signature. This should
// ALWAYS be a wallet used only for this purpose, never a personal wallet,
// and on studionet the tokens it holds have no real-world value.
//
// Required env vars:
//   KEEPER_PRIVATE_KEY        - 0x-prefixed private key for the keeper wallet
//   GENLAYER_CONTRACT_ADDRESS - same market address the frontend uses
//   GENLAYER_NETWORK          - defaults to "studionet" if unset
import { createClient, createAccount } from "genlayer-js";
import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";

const chainMap = {
  localnet,
  studionet,
  testnetBradbury: testnetAsimov,
};

function todayISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export default async (req) => {
  const { next_run } = await req.json().catch(() => ({}));

  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS;
  const networkKey = process.env.GENLAYER_NETWORK || "studionet";
  const chain = chainMap[networkKey] || studionet;

  if (!privateKey || !contractAddress) {
    const missing = [!privateKey && "KEEPER_PRIVATE_KEY", !contractAddress && "GENLAYER_CONTRACT_ADDRESS"]
      .filter(Boolean)
      .join(", ");
    console.log(`resolve-keeper: skipped, missing env var(s): ${missing}`);
    return new Response(JSON.stringify({ skipped: true, reason: `missing ${missing}` }), { status: 200 });
  }

  try {
    const account = createAccount(privateKey);
    const client = createClient({ chain, account });

    const market = await client.readContract({
      address: contractAddress,
      functionName: "get_market",
      args: [],
    });

    if (market.has_resolved) {
      console.log("resolve-keeper: already resolved, nothing to do");
      return new Response(JSON.stringify({ skipped: true, reason: "already resolved" }), { status: 200 });
    }

    // Conservative: only attempt once the calendar date after the match has
    // arrived. The contract only stores a date (no kickoff time), so this
    // avoids trying to resolve while the match might still be in progress.
    // If it's genuinely still unresolved, the next run 30 minutes later just
    // tries again — safe and idempotent either way.
    const isDue = todayISO() > market.game_date;
    if (!isDue) {
      console.log(`resolve-keeper: not due yet (game_date=${market.game_date})`);
      return new Response(JSON.stringify({ skipped: true, reason: "not due yet", game_date: market.game_date }), {
        status: 200,
      });
    }

    console.log(`resolve-keeper: resolving market for ${market.home_team} vs ${market.away_team} (${market.game_date})`);
    const txHash = await client.writeContract({
      address: contractAddress,
      functionName: "resolve",
      args: [],
      value: 0n,
    });
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, retries: 40, interval: 4000 });

    console.log("resolve-keeper: resolve() submitted", txHash);
    return new Response(
      JSON.stringify({ resolved: true, txHash, receiptStatus: receipt?.status, next_run }),
      { status: 200 }
    );
  } catch (error) {
    console.error("resolve-keeper: error", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500 });
  }
};

export const config = {
  schedule: "*/30 * * * *",
};
