import { oddsSources } from "../config.js";
import { $ } from "../utils.js";

function toDecimalOdds(prob) {
  const safe = Math.min(96, Math.max(4, prob));
  return (100 / safe).toFixed(2);
}

function buildOddsRows(home, draw, away) {
  return oddsSources.map((source) => {
    const h = Math.min(92, Math.max(4, home + source.variance));
    const d = Math.min(92, Math.max(4, draw - source.variance / 2));
    const a = Math.max(4, 100 - h - d);
    return { ...source, home: toDecimalOdds(h), draw: toDecimalOdds(d), away: toDecimalOdds(a) };
  });
}

export function renderOddsBoard(home, draw, away) {
  const rows = buildOddsRows(home, draw, away);
  const bestHome = Math.max(...rows.map((row) => Number(row.home)));
  const bestDraw = Math.max(...rows.map((row) => Number(row.draw)));
  const bestAway = Math.max(...rows.map((row) => Number(row.away)));

  const cell = (value, best) => `<span class="odds-cell${Number(value) === best ? " best" : ""}">${value}</span>`;

  $("#odds-board").innerHTML = `
    <div class="odds-row odds-head">
      <span>Source</span><span>Home</span><span>Draw</span><span>Away</span>
    </div>
    ${rows
      .map(
        (row) => `
      <div class="odds-row${row.isAi ? " odds-ai" : ""}">
        <span class="odds-source">${row.isAi ? '<span class="ai-dot"></span>' : ""}${row.name}</span>
        ${cell(row.home, bestHome)}
        ${cell(row.draw, bestDraw)}
        ${cell(row.away, bestAway)}
      </div>`
      )
      .join("")}
  `;
}
