import { matches, setMatches } from "../state.js";
import { $, makeBadge } from "../utils.js";
import { setConditionFromMatch } from "./featured.js";

export function renderMarkets(onSelectMatch) {
  if (!matches.length) {
    $("#market-list").innerHTML = `<div class="empty-state">No live matches found. Check your API configuration and refresh.</div>`;
    return;
  }

  $("#market-list").innerHTML = matches
    .map(
      (match, index) => `
        <div class="market-row">
          <div>
            <span class="market-title">
              <span class="market-team">
                ${match.homeLogo ? `<img class="market-logo" src="${match.homeLogo}" alt="${match.homeTeam} logo" onerror="this.onerror=null;this.src='${makeBadge(match.homeTeam)}'" />` : ""}
                ${match.title}
                ${match.awayLogo ? `<img class="market-logo" src="${match.awayLogo}" alt="${match.awayTeam} logo" onerror="this.onerror=null;this.src='${makeBadge(match.awayTeam)}'" />` : ""}
              </span>
            </span>
            <span class="market-meta">${match.league} - ${match.meta}</span>
          </div>
          <div class="market-odds" aria-label="${match.title} probabilities">
            ${match.odds.map((odd) => `<span class="odd">${odd}</span>`).join("")}
          </div>
          <button class="secondary-button compact-button select-market" data-index="${index}">Use Match</button>
        </div>
      `
    )
    .join("");

  document.querySelectorAll(".select-market").forEach((button) => {
    button.addEventListener("click", () => {
      const match = matches[Number(button.dataset.index)];
      if (match) {
        setMatches([match, ...matches.filter((item) => item.title !== match.title)]);
        setConditionFromMatch(match);
        renderMarkets(onSelectMatch);
        onSelectMatch?.();
        $("#resolver").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}
