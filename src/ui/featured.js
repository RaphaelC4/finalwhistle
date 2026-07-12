import { appState } from "../state.js";
import { $, todayISO, jitter, setBar, setImage } from "../utils.js";

const CHIP_DEFS = [
  { type: "home-win", label: "Home Win" },
  { type: "away-win", label: "Away Win" },
  { type: "draw", label: "Draw" },
  { type: "btts", label: "BTTS" },
  { type: "over25", label: "Over 2.5" },
  { type: "custom", label: "Custom" },
];

function buildConditionText(type, match) {
  const h = match.homeTeam;
  const a = match.awayTeam;
  switch (type) {
    case "home-win": return `${h} will beat ${a} by full time.`;
    case "away-win": return `${a} will beat ${h} by full time.`;
    case "draw": return `Draw between ${h} and ${a}.`;
    case "btts": return `Both teams will score in ${h} vs ${a}.`;
    case "over25": return `Over 2.5 goals in ${h} vs ${a}.`;
    case "custom": return "";
    default: return "";
  }
}

function setActiveChip(type) {
  document.querySelectorAll(".chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.type === type);
  });
}

let currentMatchRef = null;

export function renderConditionChips(match) {
  currentMatchRef = match;
  const container = $("#condition-chips");
  if (!container) return;

  container.innerHTML = CHIP_DEFS
    .map((c) => `<button class="chip${c.type === "home-win" ? " active" : ""}${c.type === "custom" ? " chip-custom" : ""}" data-type="${c.type}">${c.label}</button>`)
    .join("");

  container.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const textarea = $("#bet-condition");
      textarea.value = buildConditionText(type, match);
      setActiveChip(type);
      if (type === "custom") {
        textarea.focus();
      }
      appState.conditionTouched = true;
    });
  });

  const textarea = $("#bet-condition");
  textarea.removeEventListener("input", onTextareaInput);
  textarea.addEventListener("input", onTextareaInput);
}

function onTextareaInput() {
  appState.conditionTouched = true;
  const container = $("#condition-chips");
  if (!container) return;
  const active = container.querySelector(".chip.active");
  if (active && active.dataset.type !== "custom") {
    setActiveChip("custom");
  }
}

export function buildSignals(match, home, draw, away) {
  const gap = Math.abs(home - away);
  const favorite = home >= away ? match.homeTeam : match.awayTeam;
  const isLive = /live/i.test(match.status || "");

  return [
    ["Model lean", `${favorite} favored by ${gap} pts`, `${Math.max(home, away)}%`],
    ["Draw risk", draw >= 30 ? "Elevated — tight matchup" : "Low — clear favorite", `${draw}%`],
    ["Match state", isLive ? match.status.replace(/^Live\s*-?\s*/i, "") || "In play" : match.status || "Scheduled", isLive ? "Live" : "—"],
  ];
}

function describeGap(gap) {
  if (gap >= 30) return "strongly favors";
  if (gap >= 12) return "leans toward";
  return "sees a close call, tilting slightly toward";
}

export function buildAiRead(match, home, draw, away) {
  const top = Math.max(home, draw, away);
  const isLive = /live/i.test(match.status || "");
  const scoreKnown = isLive && match.homeScore !== "-" && match.homeScore !== undefined && match.homeScore !== null;
  const scoreNote = scoreKnown ? ` at ${match.homeScore}-${match.awayScore}` : "";

  if (top === draw && draw >= home && draw >= away) {
    return `Model rates the draw most likely (${draw}%) between ${match.homeTeam} and ${match.awayTeam}${scoreNote}.`;
  }

  const homeLeads = home >= away;
  const leader = homeLeads ? match.homeTeam : match.awayTeam;
  const trailer = homeLeads ? match.awayTeam : match.homeTeam;
  const leadProb = homeLeads ? home : away;
  const gap = Math.abs(home - away);

  return `Model ${describeGap(gap)} ${leader} over ${trailer}${scoreNote}, at ${leadProb}% win probability.`;
}

export function setConditionFromMatch(match) {
  if (!match) return;
  const textarea = $("#bet-condition");
  textarea.value = `${match.homeTeam} will beat ${match.awayTeam} by full time.`;
  appState.conditionTouched = false;
  setActiveChip("home-win");
}

export function setFeaturedMatch(match) {
  $("#featured-league").textContent = match.league;
  $("#featured-title").textContent = match.title;
  $("#featured-status").textContent = match.status || "Today";
  $("#home-team-name").textContent = match.homeTeam;
  $("#away-team-name").textContent = match.awayTeam;
  $("#home-score").textContent = match.homeScore ?? "-";
  $("#away-score").textContent = match.awayScore ?? "-";
  setImage("#home-logo", match.homeLogo, `${match.homeTeam} logo`, match.homeColors);
  setImage("#away-logo", match.awayLogo, `${match.awayTeam} logo`, match.awayColors);
  if (!appState.conditionTouched) {
    setConditionFromMatch(match);
  }
  if (!appState.dateTouched) {
    $("#match-date").value = match.matchDate || todayISO();
  }
}
