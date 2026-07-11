import { appState, matches, betHistory, getConfiguredContractAddress, addBetRecord, updateLastBetRecord } from "../state.js";
import { $, shortAddress } from "../utils.js";
import { writeContractUpdateMarket, writeContractResolve, readContractMarket } from "../genlayer/client.js";
import { connectWallet } from "../genlayer/wallet.js";
import { networkLabels } from "../config.js";

function verdictLabel(status, verdict) {
  if (status === "pending") return "Pending";
  if (verdict === "true") return "Won";
  if (verdict === "false") return "Lost";
  return "Unresolved";
}

export function renderBetHistory() {
  const container = $("#bet-history-list");
  if (!betHistory.length) {
    container.innerHTML = `<div class="empty-state">No bets yet — submit one from the resolver above and it'll show up here.</div>`;
    return;
  }

  container.innerHTML = betHistory
    .map((bet) => {
      const badgeClass = bet.status === "pending" ? "pending" : bet.verdict || "unresolved";
      return `
        <div class="bet-row">
          <div>
            <span class="bet-row-match">${bet.matchTitle}</span>
            <span class="bet-row-condition">${bet.condition}</span>
          </div>
          <div class="bet-row-stake">
            <strong>${bet.stake} ${bet.asset}</strong>
            <span>${new Date(bet.timestamp).toLocaleDateString()}</span>
          </div>
          <span class="status-badge ${badgeClass}">${verdictLabel(bet.status, bet.verdict)}</span>
        </div>
      `;
    })
    .join("");
}

export async function submitBet() {
  const condition = $("#bet-condition").value.trim();
  const stake = $("#stake").value;
  const asset = $("#asset").value;

  if (!appState.wallet) {
    await connectWallet();
    if (!appState.wallet) return;
  }

  if (!condition) {
    $("#resolver-output").innerHTML = `
      <span>Missing condition</span>
      <strong>Add the natural-language bet condition before submitting.</strong>
    `;
    return;
  }

  if (!appState.hasContract) {
    $("#resolver-output").innerHTML = `
      <span>Contract required</span>
      <strong>No contract is configured on the server.</strong>
      <p>Deploy a FinalWhistleResolver contract and set GENLAYER_CONTRACT_ADDRESS.</p>
    `;
    return;
  }

  $("#resolver-output").innerHTML = `
    <span>Submitting to GenLayer…</span>
    <strong>Sending update_market(). Waiting for validator consensus…</strong>
  `;

  try {
    const contract = await getConfiguredContractAddress();
    const match = matches[0];
    if (!match) throw new Error("No match selected");
    const { txHash } = await writeContractUpdateMarket(contract, match, condition);
    appState.lastTx = txHash;

    const market = await readContractMarket(contract);

    addBetRecord({
      id: txHash,
      matchTitle: match.title,
      condition: market.condition || condition,
      stake,
      asset,
      status: "pending",
      verdict: null,
      timestamp: Date.now(),
    });

    $("#resolver-output").innerHTML = `
      <span>Bet submitted ✓</span>
      <strong>update_market() accepted on ${networkLabels[$("#rpc-target").value] || "GenLayer"}.</strong>
      <div class="result-grid">
        <div class="result-chip"><span>Tx</span><strong>${shortAddress(txHash)}</strong></div>
        <div class="result-chip"><span>Stake</span><strong>${stake} ${asset}</strong></div>
        <div class="result-chip"><span>Contract</span><strong>Configured</strong></div>
        <div class="result-chip"><span>Condition</span><strong>${market.condition || condition}</strong></div>
      </div>
    `;
  } catch (error) {
    $("#resolver-output").innerHTML = `
      <span>Transaction failed</span>
      <strong>${error.message || "GenLayer write failed."}</strong>
      <p>Check contract, wallet funds, and network.</p>
    `;
  }
}

export async function resolveBet() {
  if (!appState.hasContract) {
    $("#resolver-output").innerHTML = `
      <span>Contract required</span>
      <strong>No contract is configured on the server.</strong>
      <p>Deploy a FinalWhistleResolver contract and set GENLAYER_CONTRACT_ADDRESS.</p>
    `;
    return;
  }

  if (!appState.wallet) {
    await connectWallet();
    if (!appState.wallet) return;
  }

  $("#resolver-output").innerHTML = `
    <span>Resolving on GenLayer…</span>
    <strong>Calling resolve().</strong>
    <p>AI validators are reading live match data.</p>
  `;

  try {
    const contract = await getConfiguredContractAddress();
    const { txHash } = await writeContractResolve(contract);
    appState.lastTx = txHash;

    const market = await readContractMarket(contract);

    updateLastBetRecord({
      status: "resolved",
      verdict: market.verdict,
      finalScore: market.final_score,
    });

    const verdictColor =
      market.verdict === "true" ? "#51e08b" : market.verdict === "false" ? "#ff6f61" : "#f6c85f";

    $("#resolver-output").innerHTML = `
      <span>Resolution complete ✓</span>
      <strong style="color:${verdictColor}">Verdict: ${market.verdict?.toUpperCase() ?? "UNRESOLVED"}</strong>
      <div class="result-grid">
        <div class="result-chip"><span>Score</span><strong>${market.final_score}</strong></div>
        <div class="result-chip"><span>Confidence</span><strong>${market.confidence}%</strong></div>
        <div class="result-chip"><span>Tx</span><strong>${shortAddress(txHash)}</strong></div>
        <div class="result-chip"><span>Condition</span><strong>${market.condition}</strong></div>
      </div>
    `;
  } catch (error) {
    $("#resolver-output").innerHTML = `
      <span>Resolve failed</span>
      <strong>${error.message || "GenLayer resolve() call failed."}</strong>
      <p>Try again after the final whistle.</p>
    `;
  }
}
