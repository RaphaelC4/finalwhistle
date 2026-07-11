import { $ } from "../utils.js";
import { buildSignals } from "./featured.js";

export function renderSignals(match, home, draw, away) {
  $("#signal-list").innerHTML = buildSignals(match, home, draw, away)
    .map(
      ([title, copy, score]) => `
        <div class="signal-item">
          <div>
            <strong>${title}</strong>
            <span>${copy}</span>
          </div>
          <div class="signal-score">${score}</div>
        </div>
      `
    )
    .join("");
}
