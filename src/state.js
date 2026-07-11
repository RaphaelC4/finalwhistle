import { $ } from "./utils.js";

export const appState = {
  wallet: "",
  lastTx: "",
  liveFeed: "idle",
  conditionTouched: false,
  dateTouched: false,
  hasContract: false,
  contractAddress: "",
  lastBetId: "",
};

export let matches = [];

export function setMatches(newMatches) {
  matches = newMatches;
}

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
    // Storage can fail (private browsing, quota).
  }
}

export let betHistory = loadBetHistory();

let onBetHistoryChange = () => {};

export function setOnBetHistoryChange(cb) {
  onBetHistoryChange = cb;
}

export function addBetRecord(record) {
  betHistory = [record, ...betHistory];
  saveBetHistory(betHistory);
  appState.lastBetId = record.id;
  onBetHistoryChange();
}

export function updateLastBetRecord(patch) {
  if (!appState.lastBetId) return;
  betHistory = betHistory.map((bet) => (bet.id === appState.lastBetId ? { ...bet, ...patch } : bet));
  saveBetHistory(betHistory);
  onBetHistoryChange();
}

export function clearBetHistory() {
  betHistory = [];
  saveBetHistory(betHistory);
  appState.lastBetId = "";
  onBetHistoryChange();
}

export async function loadPublicConfig() {
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
}

export async function getConfiguredContractAddress() {
  if (appState.contractAddress) return appState.contractAddress;
  const response = await fetch("/api/contract-address", { cache: "no-store" });
  if (!response.ok) throw new Error("Contract is not configured on the server.");
  const { address } = await response.json();
  appState.contractAddress = address;
  return address;
}
