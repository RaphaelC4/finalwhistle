export const $ = (selector) => document.querySelector(selector);

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function makeBadge(teamName, colors) {
  const initials =
    teamName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "FC";
  const bg = colors?.primary || "#123f33";
  const fg = colors?.text || "#51e08b";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="36" fill="${bg}"/>
      <text x="40" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="800" fill="${fg}">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

export function findValue(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }
  return "";
}

export function setImage(selector, src, alt, colors) {
  const image = $(selector);
  if (!image) return;
  image.alt = alt;
  const fallback = makeBadge(alt, colors);
  image.onerror = () => {
    image.onerror = null;
    image.src = fallback;
  };
  image.src = src || fallback;
}

export function setBar(id, value) {
  $(id).style.width = `${value}%`;
}

export function jitter(value, amount = 5) {
  const change = Math.round((Math.random() * amount * 2 - amount) * 10) / 10;
  return Math.max(4, Math.min(88, value + change));
}

export function buildSourceUrl(match, isoDateOverride) {
  const isoDate = isoDateOverride || match.matchDate || todayISO();
  return `https://www.bbc.com/sport/football/scores-fixtures/${isoDate}`;
}

const sportsdBadgeCache = new Map();

export async function fetchTheSportsDBBadge(teamName) {
  if (sportsdBadgeCache.has(teamName)) return sportsdBadgeCache.get(teamName);
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`
    );
    const data = await res.json();
    const badge = data.teams?.[0]?.strBadge || null;
    sportsdBadgeCache.set(teamName, badge);
    return badge;
  } catch {
    sportsdBadgeCache.set(teamName, null);
    return null;
  }
}
