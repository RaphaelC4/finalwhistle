// ─── GenLayer SDK ────────────────────────────────────────────────────────────
import { createClient, createAccount } from "genlayer-js";
import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
// NOTE: only these three imports — do not add any more genlayer imports below

// ─── Fallback match data ──────────────────────────────────────────────────────
const fallbackMatches = [
  {
    title: "Arsenal vs Manchester City",
    league: "Premier League",
    meta: "Live 68' - Emirates Stadium",
    status: "Live 68'",
    homeTeam: "Arsenal",
    awayTeam: "Manchester City",
    homeScore: 2,
    awayScore: 1,
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    home: 64,
    draw: 22,
    away: 14,
    odds: ["ARS 1.74", "Draw 4.20", "MCI 5.60"],
  },
  {
    title: "Barcelona vs Real Madrid",
    league: "La Liga",
    meta: "Today - 20:00",
    status: "Scheduled",
    homeTeam: "Barcelona",
    awayTeam: "Real Madrid",
    homeScore: "-",
    awayScore: "-",
    home: 38,
    draw: 29,
    away: 33,
    odds: ["BAR 2.42", "Draw 3.45", "RMA 2.84"],
  },
  {
    title: "Bayern Munich vs Dortmund",
    league: "Bundesliga",
    meta: "Today - 18:30",
    status: "Scheduled",
    homeTeam: "Bayern Munich",
    awayTeam: "Dortmund",
    homeScore: "-",
    awayScore: "-",
    home: 57,
    draw: 24,
    away: 19,
    odds: ["BAY 1.92", "Draw 3.90", "BVB 4.10"],
  },
  {
    title: "Inter Milan vs Juventus",
    league: "Serie A",
    meta: "Tomorrow - 19:45",
    status: "Scheduled",
    homeTeam: "Inter Milan",
    awayTeam: "Juventus",
    homeScore: "-",
    awayScore: "-",
    home: 44,
    draw: 31,
    away: 25,
    odds: ["INT 2.18", "Draw 3.20", "JUV 3.30"],
  },
];

// Start with fallback so market list is never empty on first render
let matches = [...fallbackMatches];

const fallbackMatchesUnavailable = [
  {
    title: "Live feed unavailable",
    league: "Football",
    meta: "Check API/network and refresh",
    status: "Offline",
    homeTeam: "Live",
    awayTeam: "Feed",
    homeScore: "-",
    awayScore: "-",
    homeLogo: "",
    awayLogo: "",
    home: 34,
    draw: 33,
    away: 33,
    odds: ["Home 34%", "Draw 33%", "Away 33%"],
  },
];

const prestigeTerms = [
  "premier league", "champions league", "europa league", "la liga",
  "serie a", "bundesliga", "ligue 1", "fa cup", "carabao cup",
  "arsenal", "chelsea", "liverpool", "manchester united", "man united",
  "manchester city", "man city", "tottenham", "newcastle", "real madrid",
  "barcelona", "atletico", "bayern", "dortmund", "leverkusen",
  "psg", "marseille", "inter", "milan", "juventus", "napoli", "roma",
  "ajax", "psv", "benfica", "porto", "sporting", "celtic", "rangers",
  "sevilla", "espanyol", "almeria",
];

const signals = [
  ["Shot quality", "Home xG trend has improved across the last 12 minutes.", "+18%"],
  ["Momentum", "Possession is stable, but final-third entries favor Arsenal.", "+11%"],
  ["Risk", "One yellow card creates defensive substitution pressure.", "-6%"],
  ["Market drift", "Public price moved slower than the AI probability update.", "+9%"],
];

// AI read is generated live from the current probabilities in buildAiRead() —
// see below. No static string pool.

// ─── GenLayer chain map ───────────────────────────────────────────────────────
const chainMap = {
  localnet: localnet,
  studionet: studionet,
  testnetBradbury: testnetAsimov, // testnetAsimov is the correct export; Bradbury is the alias
};

const networkLabels = {
  localnet: "GenLayer localnet",
  studionet: "GenLayer studionet",
  testnetBradbury: "GenLayer testnet Bradbury",
};

// ─── App state ────────────────────────────────────────────────────────────────
const appState = {
  wallet: "",
  lastTx: "",
  liveFeed: "fallback",
  conditionTouched: false,
  dateTouched: false,
  hasContract: false,
  contractAddress: "",
  lastBetId: "",
};

// ─── Odds comparison sources ──────────────────────────────────────────────────
// Fictional market names (not real bookmakers) since these are simulated
// prices derived from the model's own probability, offset per source so the
// comparison is meaningful rather than four copies of the same number.
const oddsSources = [
  { name: "Pitchside Odds", variance: 4 },
  { name: "Kickoff Markets", variance: -3 },
  { name: "Fulltime Exchange", variance: 2 },
  { name: "FinalWhistle AI", variance: 0, isAi: true },
];

// ─── Bet history (localStorage) ────────────────────────────────────────────────
const BET_HISTORY_KEY = "finalwhistle:bet-history";

function loadBetHistory() {
  try {
    const raw = localStorage.getItem(BET_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBetHistory(bets) {
  try {
    localStorage.setItem(BET_HISTORY_KEY, JSON.stringify(bets.slice(0, 50)));
  } catch {
    // Storage can fail (private browsing, quota) — history just won't persist.
  }
}

let betHistory = loadBetHistory();

function addBetRecord(record) {
  betHistory = [record, ...betHistory];
  saveBetHistory(betHistory);
  appState.lastBetId = record.id;
  renderBetHistory();
  renderLeaderboard();
}

function updateLastBetRecord(patch) {
  if (!appState.lastBetId) return;
  betHistory = betHistory.map((bet) => (bet.id === appState.lastBetId ? { ...bet, ...patch } : bet));
  saveBetHistory(betHistory);
  renderBetHistory();
  renderLeaderboard();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const $ = (selector) => document.querySelector(selector);

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function demoTxId(prefix) {
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${Date.now().toString(16)}${random}`;
}

function updateContractLabels() {
  const network = $("#rpc-target").value;
  $("#network-label").textContent = networkLabels[network] || network;
  $("#contract-label").textContent = appState.hasContract ? "Configured" : "Demo mode";
}

async function loadPublicConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Config unavailable");
    const config = await response.json();
    appState.hasContract = Boolean(config.hasContract);
    if (config.defaultNetwork && $("#rpc-target")) {
      $("#rpc-target").value = config.defaultNetwork;
    }
  } catch {
    appState.hasContract = false;
  }
  updateContractLabels();
}

async function getConfiguredContractAddress() {
  if (appState.contractAddress) return appState.contractAddress;
  const response = await fetch("/api/contract-address", { cache: "no-store" });
  if (!response.ok) throw new Error("Contract is not configured on the server.");
  const { address } = await response.json();
  appState.contractAddress = address;
  return address;
}

function setWalletConnected(address, source = "Wallet") {
  appState.wallet = address;
  $("#connect-wallet").classList.add("connected");
  $("#connect-wallet").textContent = shortAddress(appState.wallet);
  $("#wallet-status").textContent = `${source} ${shortAddress(appState.wallet)}`;
  renderLeaderboard();
}

function updateClock() {
  $("#clock").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setBar(id, value) {
  $(id).style.width = `${value}%`;
}

function jitter(value, amount = 5) {
  const change = Math.round((Math.random() * amount * 2 - amount) * 10) / 10;
  return Math.max(4, Math.min(88, value + change));
}

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSourceUrl(match, isoDateOverride) {
  // The contract's LLM resolver needs a page it can actually read a live
  // match report or score from. Provider "documentation" URLs and raw API
  // endpoints (api-football.com/documentation-v3, v3.football.api-sports.io)
  // are either static docs or require an auth header the contract can't
  // send, so gl.nondet.web.get always comes back empty/unresolved.
  // Instead, point at the public BBC Sport fixtures/scores page for the
  // match date, which lists final scores in plain readable HTML.
  const isoDate = isoDateOverride || match.matchDate || todayISO();
  return `https://www.bbc.com/sport/football/scores-fixtures/${isoDate}`;
}

function findValue(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }
  return "";
}

function makeBadge(teamName) {
  const initials =
    teamName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "FC";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="36" fill="#eef8f1"/>
      <circle cx="40" cy="40" r="30" fill="#123f33"/>
      <text x="40" y="47" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#51e08b">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function inferProbability(match, index) {
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  if (hasScore && homeScore !== awayScore) {
    const leaderHome = homeScore > awayScore;
    return { home: leaderHome ? 62 : 18, draw: 22, away: leaderHome ? 16 : 60 };
  }
  const seed = (match.title.length + index * 13) % 18;
  return { home: 42 + seed, draw: 25, away: 33 - Math.min(seed, 12) };
}

function normalizeSportSrcMatch(raw, index) {
  const homeTeam =
    raw.teams?.home?.name ||
    findValue(raw, ["home", "homeTeam", "team_home", "home_name", "team1", "strHomeTeam"]) ||
    "Home";
  const awayTeam =
    raw.teams?.away?.name ||
    findValue(raw, ["away", "awayTeam", "team_away", "away_name", "team2", "strAwayTeam"]) ||
    "Away";
  const league = findValue(raw, ["league", "competition", "tournament", "strLeague"]) || "Football";
  const timestamp = findValue(raw, ["timestamp", "time", "date", "start_time", "event_time", "strTimestamp"]);
  const kickoffDate = Number(timestamp) ? new Date(Number(timestamp)) : null;
  const kickoff = kickoffDate
    ? kickoffDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : timestamp;
  // SportSRC's `?data=matches` endpoint is a schedule/fixture list only —
  // verified against a live response, it returns id/title/teams/date/poster
  // and nothing else. There is no score field to read here (live or final),
  // so we don't pretend otherwise. Real live scores only come from the
  // SofaScore feed (raw.homeScore.current/awayScore.current in
  // normalizeSofaScoreMatch) — this is purely the schedule-only fallback.
  // SportSRC's `data=detail` endpoint may carry richer per-match data, but
  // this fallback path doesn't call it (that'd be one request per match).
  const rawStatus = findValue(raw, ["status", "match_status", "state", "time_status", "live_status"]);
  const status = rawStatus || (kickoffDate && kickoffDate <= new Date() ? "Kickoff passed" : "Upcoming");
  const homeScore = "-";
  const awayScore = "-";
  const homeLogo =
    raw.teams?.home?.badge ||
    findValue(raw, ["home_badge", "home_logo", "homeLogo", "strHomeTeamBadge"]) ||
    makeBadge(homeTeam);
  const awayLogo =
    raw.teams?.away?.badge ||
    findValue(raw, ["away_badge", "away_logo", "awayLogo", "strAwayTeamBadge"]) ||
    makeBadge(awayTeam);
  const match = {
    title: raw.title || `${homeTeam} vs ${awayTeam}`,
    league,
    meta: `${status}${kickoff ? ` - ${kickoff}` : ""}`,
    status,
    sourceUrl:
      raw.url ||
      raw.sourceUrl ||
      `https://sportsrc.org/event/${raw.id || encodeURIComponent(raw.title || "")}`,
    matchDate: kickoffDate ? kickoffDate.toISOString().slice(0, 10) : todayISO(),
    kickoffTime: kickoffDate ? kickoffDate.getTime() : 0,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    homeLogo,
    awayLogo,
    odds: [],
  };
  const probability = inferProbability(match, index);
  return {
    ...match,
    ...probability,
    odds: [`Home ${probability.home}%`, `Draw ${probability.draw}%`, `Away ${probability.away}%`],
  };
}

// SofaScore's underlying event schema is well-established (it's the same
// shape used across sofascore.com's own site and every wrapper/scraper
// built on it): homeScore.current / awayScore.current for the live score,
// status.type for state ("inprogress" | "finished" | "notstarted" | ...),
// startTimestamp in unix seconds. The RapidAPI "apidojo" wrapper proxies
// this data directly, so this normalizer targets that real schema rather
// than guessing at RapidAPI-specific field names.
function normalizeSofaScoreMatch(raw, index) {
  const homeTeam = raw.homeTeam?.name || raw.homeTeam?.shortName || "Home";
  const awayTeam = raw.awayTeam?.name || raw.awayTeam?.shortName || "Away";
  const statusType = raw.status?.type || "notstarted";
  const isLive = statusType === "inprogress";
  const date = raw.startTimestamp ? new Date(raw.startTimestamp * 1000) : null;
  const homeScore = raw.homeScore?.current ?? raw.homeScore?.display ?? "-";
  const awayScore = raw.awayScore?.current ?? raw.awayScore?.display ?? "-";
  const statusLabel =
    statusType === "finished"
      ? "Finished"
      : statusType === "notstarted"
      ? "Scheduled"
      : raw.status?.description || "Live";
  const match = {
    eventId: raw.id,
    title: `${homeTeam} vs ${awayTeam}`,
    league: raw.tournament?.name || raw.tournament?.uniqueTournament?.name || "Football",
    meta: `${statusLabel}${date ? ` - ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`,
    status: isLive && raw.status?.description ? `Live - ${raw.status.description}` : statusLabel,
    sourceUrl: raw.id ? `https://www.sofascore.com/event/${raw.id}` : "https://www.sofascore.com/",
    matchDate: date ? date.toISOString().slice(0, 10) : todayISO(),
    kickoffTime: date ? date.getTime() : 0,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    homeLogo: raw.homeTeam?.id ? `https://api.sofascore.com/api/v1/team/${raw.homeTeam.id}/image` : makeBadge(homeTeam),
    awayLogo: raw.awayTeam?.id ? `https://api.sofascore.com/api/v1/team/${raw.awayTeam.id}/image` : makeBadge(awayTeam),
    odds: [],
  };
  const probability = inferProbability(match, index);
  return {
    ...match,
    ...probability,
    odds: [`Home ${probability.home}%`, `Draw ${probability.draw}%`, `Away ${probability.away}%`],
  };
}

function prestigeScore(match) {
  const haystack = `${match.title} ${match.league} ${match.homeTeam} ${match.awayTeam}`.toLowerCase();
  return prestigeTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function buildEliteMatchList(liveMatches) {
  const elite = liveMatches
    .map((match) => ({ ...match, prestige: prestigeScore(match) }))
    .filter((match) => match.prestige > 0)
    .sort((a, b) => b.prestige - a.prestige || a.title.localeCompare(b.title));
  const broadLive = liveMatches
    .filter((match) => !elite.some((item) => item.title === match.title))
    .sort((a, b) => (a.kickoffTime || 0) - (b.kickoffTime || 0));
  return [...elite, ...broadLive].slice(0, 12);
}

function setImage(selector, src, alt) {
  const image = $(selector);
  if (!image) return;
  image.src = src || makeBadge(alt);
  image.alt = alt;
}

function setFeaturedMatch(match) {
  $("#featured-league").textContent = match.league;
  $("#featured-title").textContent = match.title;
  $("#featured-status").textContent = match.status || "Today";
  $("#home-team-name").textContent = match.homeTeam;
  $("#away-team-name").textContent = match.awayTeam;
  $("#home-score").textContent = match.homeScore ?? "-";
  $("#away-score").textContent = match.awayScore ?? "-";
  setImage("#home-logo", match.homeLogo, `${match.homeTeam} logo`);
  setImage("#away-logo", match.awayLogo, `${match.awayTeam} logo`);
  if (!appState.conditionTouched) {
    setConditionFromMatch(match);
  }
  if (!appState.dateTouched) {
    $("#match-date").value = match.matchDate || todayISO();
  }
}

function setConditionFromMatch(match = matches[0] || fallbackMatches[0]) {
  $("#bet-condition").value = `${match.homeTeam} will beat ${match.awayTeam} by full time.`;
  appState.conditionTouched = false;
}

function refreshFeatured() {
  const base = matches[0] || fallbackMatches[0];
  setFeaturedMatch(base);
  const home = Math.round(jitter(base.home, 7));
  const draw = Math.round(jitter(base.draw, 4));
  const away = Math.max(4, 100 - home - draw);
  $("#home-prob").textContent = `${home}%`;
  $("#draw-prob").textContent = `${draw}%`;
  $("#away-prob").textContent = `${away}%`;
  $("#featured-confidence").textContent = `${home}%`;
  $("#ai-read").textContent = buildAiRead(base, home, draw, away);
  renderOddsBoard(home, draw, away);
  setBar("#home-bar", home);
  setBar("#draw-bar", draw);
  setBar("#away-bar", away);
}

function describeGap(gap) {
  if (gap >= 30) return "strongly favors";
  if (gap >= 12) return "leans toward";
  return "sees a close call, tilting slightly toward";
}

function buildAiRead(match, home, draw, away) {
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

function renderOddsBoard(home, draw, away) {
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

function renderSignals() {
  $("#signal-list").innerHTML = signals
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

function renderMarkets() {
  $("#market-list").innerHTML = matches
    .map(
      (match, index) => `
        <div class="market-row">
          <div>
            <span class="market-title">
              <span class="market-team">
                ${match.homeLogo ? `<img class="market-logo" src="${match.homeLogo}" alt="${match.homeTeam} logo" />` : ""}
                ${match.title}
                ${match.awayLogo ? `<img class="market-logo" src="${match.awayLogo}" alt="${match.awayTeam} logo" />` : ""}
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
          matches = [match, ...matches.filter((item) => item.title !== match.title)];
          setConditionFromMatch(match);
          renderMarkets();
          refreshFeatured();
          $("#resolver").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

// ─── Live match feeds ─────────────────────────────────────────────────────────
function verdictLabel(status, verdict) {
  if (status === "pending") return "Pending";
  if (verdict === "true") return "Won";
  if (verdict === "false") return "Lost";
  return "Unresolved";
}

function renderBetHistory() {
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

function renderLeaderboard() {
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

async function loadLiveMatches() {
  const status = $("#feed-status");
  status.textContent = "Loading today's football matches...";
  try {
    await loadSofaScoreMatches();
  } catch (error) {
    const rateLimited = error?.status === 429;
    try {
      await loadSportSrcMatches();
      if (rateLimited) {
        status.textContent += " (SofaScore quota reached — showing schedule-only fallback, no live scores)";
      }
    } catch {
      matches = [...fallbackMatchesUnavailable];
      appState.liveFeed = "fallback";
      renderMarkets();
      refreshFeatured();
      status.textContent = rateLimited
        ? "SofaScore quota reached and fallback feed unavailable — live scores will resume once quota resets"
        : "Live feed unavailable - check server/API configuration";
    }
  }
}

async function loadSofaScoreMatches() {
  const status = $("#feed-status");
  const response = await fetch("/api/sofascore-live", { cache: "no-store" });
  if (!response.ok) {
    const err = new Error(`SofaScore returned ${response.status}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  const list = data.events || data.data || data.response || [];
  if (!Array.isArray(list) || !list.length) throw new Error("SofaScore returned no live events right now");
  const normalized = list.map(normalizeSofaScoreMatch).filter((m) => m.homeTeam && m.awayTeam);
  if (!normalized.length) throw new Error("SofaScore returned no usable events");
  matches = buildEliteMatchList(normalized);
  appState.liveFeed = "sofascore";
  renderMarkets();
  refreshFeatured();
  const eliteCount = matches.filter((m) => prestigeScore(m) > 0).length;
  status.textContent = `SofaScore live: ${matches.length} matches in play, ${eliteCount} elite`;
}

async function loadSportSrcMatches() {
  const status = $("#feed-status");
  const response = await fetch("https://api.sportsrc.org/?data=matches&category=football", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Feed returned ${response.status}`);
  const data = await response.json();
  const list = Array.isArray(data) ? data : data.data || data.matches || data.events || [];
  const normalized = list
    .slice(0, 12)
    .map(normalizeSportSrcMatch)
    .filter((m) => m.homeTeam && m.awayTeam);
  const today = todayISO();
  const todayMatches = normalized.filter((match) => {
    if (!match.kickoffTime) return true;
    return new Date(match.kickoffTime).toISOString().slice(0, 10) === today;
  });
  if (!todayMatches.length) throw new Error("No matches returned for today");
  matches = buildEliteMatchList(todayMatches);
  appState.liveFeed = "sportsrc";
  renderMarkets();
  refreshFeatured();
  const eliteCount = todayMatches.filter((m) => prestigeScore(m) > 0).length;
  status.textContent =
    eliteCount > 0
      ? `SportSRC fallback: ${matches.length} matches today, ${eliteCount} elite (schedule only, no live scores)`
      : `SportSRC fallback: ${matches.length} real football matches today (schedule only, no live scores)`;
}

// ─── GenLayer SDK helpers ─────────────────────────────────────────────────────

/**
 * Build a GenLayer client using the current UI settings.
 *
 * Priority for the signer:
 *  1. Connected injected wallet (MetaMask) address — MetaMask handles signing
 *  2. Manual wallet address field — same passthrough approach
 *  3. Ephemeral createAccount() — fine for read-only / local dev
 */
function buildGenLayerClient() {
  const networkKey = $("#rpc-target").value;
  const chain = chainMap[networkKey] || studionet;
  const manualWallet = $("#manual-wallet")?.value.trim();
  const signerAddress = appState.wallet || manualWallet || null;

  if (signerAddress) {
    // Pass address string → MetaMask (or other injected wallet) handles signing
    return createClient({ chain, account: signerAddress });
  }

  // Local dev fallback: ephemeral account (no real signing power)
  const account = createAccount();
  return createClient({ chain, account });
}

/** Read the on-chain market state from a deployed FinalWhistleResolver. */
async function readContractMarket(contractAddress) {
  const client = buildGenLayerClient();
  return client.readContract({
    address: contractAddress,
    functionName: "get_market",
    args: [],
  });
}

/** Write: call update_market() to update bet condition on-chain. */
async function writeContractUpdateMarket(contractAddress, match, condition) {
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

/** Write: call resolve() to trigger AI validator resolution. */
async function writeContractResolve(contractAddress) {
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

// ─── Wallet ───────────────────────────────────────────────────────────────────
async function connectWallet() {
  const manualWallet = $("#manual-wallet")?.value.trim();
  if (manualWallet) {
    setWalletConnected(manualWallet, "Manual wallet");
    $("#resolver-output").innerHTML = `
      <span>Manual wallet mode</span>
      <strong>Using ${shortAddress(manualWallet)} for local GenLayer testing.</strong>
    `;
    return;
  }

  if (!window.ethereum) {
    $("#resolver-output").innerHTML = `
      <span>Wallet required</span>
      <strong>No injected wallet was found.</strong>
      <p>Use Chrome/Brave with MetaMask, or paste a manual wallet address.</p>
    `;
    return;
  }

  try {
    $("#connect-wallet").textContent = "Connecting...";
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts[0]) throw new Error("No account returned");
    setWalletConnected(accounts[0], "Connected");
  } catch (error) {
    $("#connect-wallet").textContent = "Connect Wallet";
    $("#resolver-output").innerHTML = `
      <span>Wallet connection failed</span>
      <strong>${error.message || "The wallet rejected or did not complete the request."}</strong>
      <p>Unlock your wallet and try again.</p>
    `;
  }
}

// ─── Submit bet ───────────────────────────────────────────────────────────────
async function submitBet() {
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
    appState.lastTx = demoTxId("demo_submit");
    const match = matches[0] || fallbackMatches[0];
    addBetRecord({
      id: appState.lastTx,
      matchTitle: match.title,
      condition,
      stake,
      asset,
      status: "pending",
      verdict: null,
      timestamp: Date.now(),
    });
    $("#resolver-output").innerHTML = `
      <span>Demo transaction prepared</span>
      <strong>Bet submitted locally for ${stake} ${asset}.</strong>
      <p>Tx: ${appState.lastTx}</p>
    `;
    return;
  }

  // Live GenLayer write
  $("#resolver-output").innerHTML = `
    <span>Submitting to GenLayer…</span>
    <strong>Sending update_market(). Waiting for validator consensus…</strong>
  `;

  try {
    const contract = await getConfiguredContractAddress();
    const match = matches[0] || fallbackMatches[0];
    const { txHash } = await writeContractUpdateMarket(contract, match, condition);
    appState.lastTx = txHash;

    // Read back the confirmed on-chain state
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

// ─── Resolve bet ──────────────────────────────────────────────────────────────
async function resolveBet() {
  const stake = $("#stake").value;
  const asset = $("#asset").value;

  if (!appState.hasContract) {
    const condition = $("#bet-condition").value.trim();
    const confidence = Math.floor(72 + Math.random() * 18);
    const likelyValid = condition.toLowerCase().includes("beat");
    const verdict = likelyValid
      ? "Likely valid if final score holds"
      : "Needs clearer settlement wording";
    if (appState.lastBetId) {
      updateLastBetRecord({
        status: "resolved",
        verdict: likelyValid ? "true" : "unresolved",
      });
    }
    $("#resolver-output").innerHTML = `
      <span>GenLayer AI resolver simulation</span>
      <strong>${verdict}</strong>
      <div class="result-grid">
        <div class="result-chip"><span>Stake</span><strong>${stake} ${asset}</strong></div>
        <div class="result-chip"><span>Confidence</span><strong>${confidence}%</strong></div>
      </div>
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

    // Read the resolved state back
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

// ─── Boot ─────────────────────────────────────────────────────────────────────
updateClock();
renderSignals();
renderMarkets();    // renders fallbackMatches immediately — no empty flash on load
refreshFeatured();
renderBetHistory();
renderLeaderboard();
loadPublicConfig();
loadLiveMatches();  // async: replaces fallback once live feed responds

setInterval(updateClock, 1000);
setInterval(refreshFeatured, 9_000);
setInterval(loadLiveMatches, 60_000);

$("#connect-wallet").addEventListener("click", connectWallet);
$("#refresh-featured").addEventListener("click", refreshFeatured);
$("#refresh-live-matches").addEventListener("click", loadLiveMatches);
$("#clear-bet-history").addEventListener("click", () => {
  betHistory = [];
  saveBetHistory(betHistory);
  appState.lastBetId = "";
  renderBetHistory();
  renderLeaderboard();
});
$("#bet-condition").addEventListener("input", () => {
  appState.conditionTouched = true;
});
$("#match-date").addEventListener("input", () => {
  appState.dateTouched = true;
});
$("#reset-condition").addEventListener("click", () => {
  setConditionFromMatch();
  appState.dateTouched = false;
  $("#match-date").value = (matches[0] || fallbackMatches[0]).matchDate || todayISO();
});
$("#submit-bet").addEventListener("click", submitBet);
$("#simulate-resolve").addEventListener("click", resolveBet);
$("#rpc-target").addEventListener("change", updateContractLabels);

if (window.ethereum) {
  window.ethereum
    .request({ method: "eth_accounts" })
    .then((accounts) => {
      if (accounts[0]) setWalletConnected(accounts[0], "Connected");
    })
    .catch(() => {});
} else {
  $("#wallet-status").textContent = "No browser wallet detected";
}
