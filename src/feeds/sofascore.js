import { todayISO, makeBadge, findValue, fetchTheSportsDBBadge } from "../utils.js";
import { teamLogoMap } from "../config.js";

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

function resolveLogoSync(teamName, teamColors) {
  if (teamLogoMap[teamName]) return teamLogoMap[teamName];
  return makeBadge(teamName, teamColors);
}

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
  const homeColors = raw.homeTeam?.teamColors || null;
  const awayColors = raw.awayTeam?.teamColors || null;
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
    homeColors,
    awayColors,
    homeLogo: resolveLogoSync(homeTeam, homeColors),
    awayLogo: resolveLogoSync(awayTeam, awayColors),
    odds: [],
  };
  const probability = inferProbability(match, index);
  return {
    ...match,
    ...probability,
    odds: [`Home ${probability.home}%`, `Draw ${probability.draw}%`, `Away ${probability.away}%`],
  };
}

async function enrichWithSportsDBBadges(matches) {
  const teamsToFetch = new Set();
  for (const match of matches) {
    if (!teamLogoMap[match.homeTeam]) teamsToFetch.add(match.homeTeam);
    if (!teamLogoMap[match.awayTeam]) teamsToFetch.add(match.awayTeam);
  }

  const fetchPromises = [...teamsToFetch].map(async (teamName) => {
    const badge = await fetchTheSportsDBBadge(teamName);
    return { teamName, badge };
  });

  const results = await Promise.allSettled(fetchPromises);
  const badgeMap = new Map();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.badge) {
      badgeMap.set(result.value.teamName, result.value.badge);
    }
  }

  for (const match of matches) {
    if (badgeMap.has(match.homeTeam)) match.homeLogo = badgeMap.get(match.homeTeam);
    if (badgeMap.has(match.awayTeam)) match.awayLogo = badgeMap.get(match.awayTeam);
  }

  return matches;
}

export async function loadSofaScoreMatches() {
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
  await enrichWithSportsDBBadges(normalized);
  return normalized;
}
