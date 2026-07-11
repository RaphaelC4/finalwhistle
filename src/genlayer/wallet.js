import { studionet } from "genlayer-js/chains";
import { chainMap, networkLabels } from "../config.js";
import { appState } from "../state.js";
import { $, shortAddress } from "../utils.js";

export async function ensureWalletChain(chain) {
  if (!window.ethereum || !chain?.id) return;
  const targetChainId = `0x${chain.id.toString(16)}`;
  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
  if (currentChainId?.toLowerCase() === targetChainId.toLowerCase()) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: targetChainId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls?.default?.http || [],
            blockExplorerUrls: chain.blockExplorers?.default?.url ? [chain.blockExplorers.default.url] : [],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export function setWalletConnected(address, source = "Wallet") {
  appState.wallet = address;
  $("#connect-wallet").classList.add("connected");
  $("#connect-wallet").textContent = shortAddress(appState.wallet);
  $("#wallet-status").textContent = `${source} ${shortAddress(appState.wallet)}`;
}

export async function connectWallet() {
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

    const chain = chainMap[$("#rpc-target").value] || studionet;
    try {
      await ensureWalletChain(chain);
    } catch (chainError) {
      setWalletConnected(accounts[0], "Connected");
      $("#resolver-output").innerHTML = `
        <span>Wrong network in wallet</span>
        <strong>Connected, but your wallet is still on the wrong chain.</strong>
        <p>${chainError.message || "Approve the network switch/add prompt to enable signing."} Transactions will fail to sign until your wallet is on ${chain.name}.</p>
      `;
      return;
    }

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
