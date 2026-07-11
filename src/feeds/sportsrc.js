import { todayISO, makeBadge, findValue } from "../utils.js";
import { prestigeTerms } from "../config.js";

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

export function prestigeScore(match) {
  const haystack = `${match.title} ${match.league} ${match.homeTeam} ${match.awayTeam}`.toLowerCase();
  return prestigeTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function buildEliteMatchList(liveMatches) {
  const elite = liveMatches
    .map((match) => ({ ...match, prestige: prestigeScore(match) }))
    .filter((match) => match.prestige > 0)
    .sort((a, b) => b.prestige - a.prestige || a.title.localeCompare(b.title));
  const broadLive = liveMatches
    .filter((match) => !elite.some((item) => item.title === match.title))
    .sort((a, b) => (a.kickoffTime || 0) - (b.kickoffTime || 0));
  return [...elite, ...broadLive].slice(0, 12);
}

export function normalizeSportSrcMatch(raw, index) {
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

export async function loadSportSrcMatches() {
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
  return todayMatches;
}
