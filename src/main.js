import { appState, matches, setMatches, setOnBetHistoryChange, clearBetHistory, loadPublicConfig } from "./state.js";
import { $, todayISO, jitter, setBar } from "./utils.js";
import { chainMap, networkLabels } from "./config.js";
import { loadSofaScoreMatches } from "./feeds/sofascore.js";
import { loadSportSrcMatches, prestigeScore, buildEliteMatchList } from "./feeds/sportsrc.js";
import { connectWallet, setWalletConnected, ensureWalletChain } from "./genlayer/wallet.js";
import { setFeaturedMatch, setConditionFromMatch, buildAiRead, renderConditionChips } from "./ui/featured.js";
import { renderSignals } from "./ui/signals.js";
import { renderOddsBoard } from "./ui/odds.js";
import { renderMarkets } from "./ui/markets.js";
import { renderBetHistory, submitBet, resolveBet, setBetFilter } from "./ui/bets.js";
import { renderLeaderboard } from "./ui/leaderboard.js";
import { renderTicker, updateTickerScores } from "./ui/ticker.js";

function updateClock() {
  $("#clock").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function updateContractLabels() {
  const network = $("#rpc-target").value;
  $("#network-label").textContent = networkLabels[network] || network;
  $("#contract-label").textContent = appState.hasContract ? "Configured" : "No contract";
}

function refreshFeatured() {
  const base = matches[0];
  if (!base) return;
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
  renderSignals(base, home, draw, away);
  setBar("#home-bar", home);
  setBar("#draw-bar", draw);
  setBar("#away-bar", away);
}

function handleSelectMatch() {
  if (matches[0]) renderConditionChips(matches[0]);
  refreshFeatured();
  appState.conditionTouched = true;
}

async function loadLiveMatches() {
  const status = $("#feed-status");
  status.textContent = "Loading today's football matches...";
  try {
    const normalized = await loadSofaScoreMatches();
    const live = buildEliteMatchList(normalized);
    setMatches(live);
    appState.liveFeed = "sofascore";
    renderMarkets(handleSelectMatch);
    renderTicker(live, handleSelectMatch);
    refreshFeatured();
    if (live[0]) renderConditionChips(live[0]);
    const eliteCount = live.filter((m) => prestigeScore(m) > 0).length;
    status.textContent = `SofaScore live: ${live.length} matches in play, ${eliteCount} elite`;
  } catch (error) {
    const rateLimited = error?.status === 429;
    try {
      const todayMatches = await loadSportSrcMatches();
      const live = buildEliteMatchList(todayMatches);
      setMatches(live);
      appState.liveFeed = "sportsrc";
      renderMarkets(handleSelectMatch);
      renderTicker(live, handleSelectMatch);
      refreshFeatured();
      if (live[0]) renderConditionChips(live[0]);
      const eliteCount = todayMatches.filter((m) => prestigeScore(m) > 0).length;
      status.textContent = rateLimited
        ? `SofaScore quota reached -- SportSRC fallback: ${live.length} matches, ${eliteCount} elite (schedule only)`
        : `SportSRC: ${live.length} matches today, ${eliteCount} elite (schedule only, no live scores)`;
    } catch {
      setMatches([]);
      appState.liveFeed = "idle";
      renderMarkets(handleSelectMatch);
      renderTicker([], handleSelectMatch);
      status.textContent = rateLimited
        ? "SofaScore quota reached and fallback unavailable -- try again later"
        : "Live feed unavailable -- check server/API configuration";
    }
  }
}

// --- Tab switching ---
const tabSections = {
  predictions: ["#predictions"],
  resolver: ["#resolver"],
  signals: ["#signals"],
  markets: ["#markets"],
  history: ["#history"],
  leaderboard: ["#leaderboard"],
};

function switchTab(tabName) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.getAttribute("href") === `#${tabName}`);
  });

  const sections = document.querySelectorAll("main > section, main > .hero-grid, main > .content-grid");
  const targets = tabSections[tabName];

  if (!targets) {
    sections.forEach((s) => (s.style.display = ""));
    return;
  }

  sections.forEach((section) => {
    const sectionId = section.id || section.querySelector("[id]")?.id;
    const shouldShow = targets.some((t) => sectionId === t.slice(1) || section.querySelector(t));
    section.style.display = shouldShow ? "" : "none";
  });
}

// --- GSAP scroll animations ---
function initScrollAnimations() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray(".market-row").forEach((row, i) => {
    gsap.from(row, {
      scrollTrigger: {
        trigger: row,
        start: "top 92%",
        toggleActions: "play none none none",
      },
      opacity: 0,
      y: 20,
      duration: 0.5,
      delay: i * 0.06,
      ease: "power2.out",
    });
  });

  gsap.utils.toArray(".signal-item").forEach((item, i) => {
    gsap.from(item, {
      scrollTrigger: {
        trigger: item,
        start: "top 94%",
        toggleActions: "play none none none",
      },
      opacity: 0,
      x: -16,
      duration: 0.45,
      delay: i * 0.08,
      ease: "power2.out",
    });
  });

  gsap.utils.toArray(".leaderboard-row").forEach((row, i) => {
    gsap.from(row, {
      scrollTrigger: {
        trigger: row,
        start: "top 94%",
        toggleActions: "play none none none",
      },
      opacity: 0,
      y: 14,
      duration: 0.4,
      delay: i * 0.07,
      ease: "power2.out",
    });
  });

  const featured = document.querySelector(".featured-match");
  if (featured) {
    gsap.from(featured, {
      scrollTrigger: {
        trigger: featured,
        start: "top 88%",
        toggleActions: "play none none none",
      },
      opacity: 0,
      y: 30,
      duration: 0.7,
      ease: "power3.out",
    });
  }

  const resolver = document.querySelector(".bet-slip");
  if (resolver) {
    gsap.from(resolver, {
      scrollTrigger: {
        trigger: resolver,
        start: "top 88%",
        toggleActions: "play none none none",
      },
      opacity: 0,
      y: 30,
      duration: 0.7,
      delay: 0.15,
      ease: "power3.out",
    });
  }
}

// --- Boot ---
setOnBetHistoryChange(() => {
  renderBetHistory();
  renderLeaderboard();
});

updateClock();
renderMarkets(handleSelectMatch);
renderBetHistory();
renderLeaderboard();
loadPublicConfig().then(updateContractLabels);
loadLiveMatches();

setInterval(updateClock, 1000);
setInterval(refreshFeatured, 9_000);
setInterval(loadLiveMatches, 60_000);
setInterval(() => updateTickerScores(matches), 15_000);

// --- Event listeners ---
$("#connect-wallet").addEventListener("click", connectWallet);
$("#refresh-featured").addEventListener("click", refreshFeatured);
$("#refresh-live-matches").addEventListener("click", loadLiveMatches);
$("#clear-bet-history").addEventListener("click", clearBetHistory);
$("#match-date").addEventListener("input", () => {
  appState.dateTouched = true;
});
$("#reset-condition").addEventListener("click", () => {
  const match = matches[0];
  if (match) {
    setConditionFromMatch(match);
    renderConditionChips(match);
    appState.dateTouched = false;
    $("#match-date").value = match.matchDate || todayISO();
  }
});
$("#submit-bet").addEventListener("click", submitBet);
$("#simulate-resolve").addEventListener("click", resolveBet);
$("#rpc-target").addEventListener("change", () => {
  updateContractLabels();
  if (appState.wallet && window.ethereum) {
    const chain = chainMap[$("#rpc-target").value];
    ensureWalletChain(chain).catch((chainError) => {
      $("#resolver-output").innerHTML = `
        <span>Wrong network in wallet</span>
        <strong>Could not switch your wallet to ${chain.name}.</strong>
        <p>${chainError.message || "Approve the network switch/add prompt to enable signing."}</p>
      `;
    });
  }
});

// Bet history tab filtering
document.querySelectorAll(".bet-tabs .segmented button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".bet-tabs .segmented button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setBetFilter(btn.dataset.filter);
  });
});

// Nav tab switching
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const tabName = item.getAttribute("href")?.slice(1);
    if (tabName) switchTab(tabName);
  });
});

// Wallet auto-detect
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

// Initialize GSAP after a short delay to ensure DOM is ready
setTimeout(initScrollAnimations, 300);
