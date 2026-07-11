import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { chainMap } from "../config.js";
import { appState } from "../state.js";
import { $, buildSourceUrl, todayISO } from "../utils.js";

export function buildGenLayerClient() {
  const networkKey = $("#rpc-target").value;
  const chain = chainMap[networkKey];
  const manualWallet = $("#manual-wallet")?.value.trim();
  const signerAddress = appState.wallet || manualWallet;

  if (!signerAddress) {
    throw new Error("No wallet connected. Connect a wallet or enter a manual address.");
  }

  return createClient({ chain, account: signerAddress });
}

export async function readContractMarket(contractAddress) {
  const client = buildGenLayerClient();
  return client.readContract({
    address: contractAddress,
    functionName: "get_market",
    args: [],
  });
}

export async function writeContractUpdateMarket(contractAddress, match, condition) {
  const client = buildGenLayerClient();
  const gameDate = $("#match-date").value || match.matchDate || todayISO();
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: "update_market",
    args: [gameDate, match.homeTeam, match.awayTeam, condition, buildSourceUrl(match, gameDate)],
    value: 0n,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.ACCEPTED,
    retries: 40,
    interval: 4000,
  });
  return { txHash, receipt };
}

export async function writeContractResolve(contractAddress) {
  const client = buildGenLayerClient();
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: "resolve",
    args: [],
    value: 0n,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    retries: 80,
    interval: 6000,
  });
  return { txHash, receipt };
}
