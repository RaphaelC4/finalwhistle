import { $ } from "../utils.js";

let tickerMatches = [];

function isLive(match) {
  return /live/i.test(match.status || "");
}

function matchMinute(match) {
  if (!isLive(match)) return "";
  const desc = match.status || "";
  const m = desc.match(/(\d+)/);
  return m ? `${m[1]}'` : "";
}

function tickerItem(match) {
  const live = isLive(match);
  const minute = matchMinute(match);
  const homeScore = match.homeScore ?? "-";
  const awayScore = match.awayScore ?? "-";
  const homeShort = match.homeTeam?.slice(0, 3).toUpperCase() || "???";
  const awayShort = match.awayTeam?.slice(0, 3).toUpperCase() || "???";
  const homeColor = match.homeColors?.primary || "#51e08b";
  const awayColor = match.awayColors?.primary || "#51e08b";

  return `
    <a class="ticker-item${live ? " live" : ""}" href="#" data-title="${match.title}">
      ${live ? '<span class="ticker-dot"></span>' : ""}
      <span class="ticker-teams">
        <span class="ticker-team-badge" style="background:${homeColor}">${homeShort}</span>
        <span class="ticker-score">${homeScore} - ${awayScore}</span>
        <span class="ticker-team-badge" style="background:${awayColor}">${awayShort}</span>
      </span>
      ${minute ? `<span class="ticker-minute">${minute}</span>` : ""}
    </a>
  `;
}

export function renderTicker(matches, onSelectMatch) {
  tickerMatches = matches;
  const container = $("#live-ticker");
  if (!container) return;

  const liveMatches = matches.filter(isLive);
  if (!liveMatches.length) {
    container.innerHTML = `<span class="ticker-empty">No live matches right now</span>`;
    return;
  }

  container.innerHTML = liveMatches.map(tickerItem).join("");

  container.querySelectorAll(".ticker-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const title = el.dataset.title;
      const match = matches.find((m) => m.title === title);
      if (match && onSelectMatch) {
        onSelectMatch(match);
      }
    });
  });
}

export function updateTickerScores(matches) {
  tickerMatches = matches;
  const container = $("#live-ticker");
  if (!container) return;

  container.querySelectorAll(".ticker-item").forEach((el) => {
    const title = el.dataset.title;
    const match = matches.find((m) => m.title === title);
    if (!match) return;

    const scoreEl = el.querySelector(".ticker-score");
    if (scoreEl) {
      const newScore = `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`;
      if (scoreEl.textContent.trim() !== newScore) {
        scoreEl.textContent = newScore;
        scoreEl.classList.add("score-flash");
        setTimeout(() => scoreEl.classList.remove("score-flash"), 1200);
      }
    }

    const minuteEl = el.querySelector(".ticker-minute");
    const minute = matchMinute(match);
    if (minuteEl && minute) {
      minuteEl.textContent = minute;
    } else if (minute && !minuteEl) {
      const teamsEl = el.querySelector(".ticker-teams");
      if (teamsEl) {
        const span = document.createElement("span");
        span.className = "ticker-minute";
        span.textContent = minute;
        el.appendChild(span);
      }
    }
  });
}
