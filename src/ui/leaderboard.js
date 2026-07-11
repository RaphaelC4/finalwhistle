import { appState, betHistory } from "../state.js";
import { $, shortAddress } from "../utils.js";

export function renderLeaderboard() {
  const container = $("#leaderboard-list");
  const resolved = betHistory.filter((bet) => bet.status === "resolved" && bet.verdict !== "unresolved");
  const rows = [];

  if (appState.wallet) {
    const wins = resolved.filter((bet) => bet.verdict === "true").length;
    const total = resolved.length;
    rows.push({ name: shortAddress(appState.wallet), wins, total, you: true });
  }

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">Connect a wallet and resolve a bet to appear on the leaderboard.</div>`;
    return;
  }

  rows.sort((a, b) => {
    const rateA = a.total ? a.wins / a.total : 0;
    const rateB = b.total ? b.wins / b.total : 0;
    return rateB - rateA || b.total - a.total;
  });

  container.innerHTML = rows
    .map((row, index) => {
      const winRate = row.total ? Math.round((row.wins / row.total) * 100) : 0;
      return `
        <div class="leaderboard-row${row.you ? " you" : ""}">
          <span class="leaderboard-rank">${index + 1}</span>
          <div>
            <span class="leaderboard-name">${row.you ? `You · ${row.name}` : row.name}</span>
            <span class="leaderboard-meta">${row.wins}W / ${row.total - row.wins}L${row.total ? "" : " · no resolved bets yet"}</span>
          </div>
          <span class="leaderboard-winrate">${row.total ? `${winRate}%` : "—"}</span>
        </div>
      `;
    })
    .join("");
}
