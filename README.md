# FinalWhistle AI

AI football prediction and bet-resolution demo for the GenLayer Builder Program.

## What is included

- Wallet connection in the frontend.
- Server-side contract configuration for live testing.
- GenLayer intelligent contract: `contracts/FinalWhistleResolver.py`.
- Real football match feed with provider logos when available.
- Contract-ready selected match flow for GenLayer resolution.

## Live football data

The app uses SofaScore (via RapidAPI) as the primary production data provider through a local backend proxy:

```text
/api/sofascore-live
```

Get a key by subscribing to the Sofascore API on RapidAPI:

```text
https://rapidapi.com/apidojo/api/sofascore
```

Put the key in `.env`:

```text
SOFASCORE_RAPIDAPI_KEY=your_key_here
PORT=4174
```

The browser never receives the API key. The Node server calls SofaScore with the secret RapidAPI headers and returns only event data to the frontend. Both the local proxy and the Netlify function cache successful responses for ~50 seconds, so many concurrent visitors share one upstream call instead of each burning your quota independently.

If the SofaScore proxy is unavailable or its quota is exhausted, the app falls back to a schedule-only feed (no live scores):

```text
https://api.sportsrc.org/?data=matches&category=football
```

It ranks Premier League and other prestigious clubs/leagues first when they are present in the live feed. It does not inject fake showcase matches into the live list.

## Deploy the contract

Install GenLayer CLI, initialize your environment, then deploy:

```bash
npm install -g genlayer
genlayer init
genlayer deploy --contract contracts/FinalWhistleResolver.py --args "2026-05-09" "Arsenal" "Manchester City" "Arsenal will beat Manchester City by full time." "https://www.bbc.com/sport/football/scores-fixtures/2026-05-09"
```

Add the deployed contract address to `.env`:

```text
GENLAYER_CONTRACT_ADDRESS=your_contract_address_here
GENLAYER_NETWORK=studionet
```

## Automatic resolution (keeper function)

Resolving a bet isn't automatic by default — someone has to click "Resolve" after the match ends. `netlify/functions/resolve-keeper.js` is a Netlify Scheduled Function that does this for you, running every 30 minutes: it checks whether the configured market's `game_date` has passed and `has_resolved` is still `false`, and if so, calls `resolve()` itself.

Because there's no human in the loop to approve a signature, this needs its own wallet to sign with — a **dedicated keeper wallet, never your personal one**. On studionet this wallet only ever holds test tokens with no real value, so the security bar is much lower than it would be on a mainnet deployment — but the separation habit is still worth keeping if you ever move this to a network where funds matter.

Generate one:

```bash
node --input-type=module -e "
import { generatePrivateKey, createAccount } from 'genlayer-js';
const pk = generatePrivateKey();
const account = createAccount(pk);
console.log('privateKey:', pk);
console.log('address:', account.address);
"
```

Fund the printed address with studionet test tokens (via GenLayer's studio faucet/dashboard), then set the private key as a secret — locally in `.env` and in Netlify's environment variables:

```text
KEEPER_PRIVATE_KEY=0x_the_private_key_you_generated
```

The scheduled function only runs on published (production) deploys, not deploy previews, and its logs show up in Netlify's Functions panel under `resolve-keeper` with a "Scheduled" badge.

## Run the frontend

Build and run the secured local server:

```bash
npm.cmd run build
npm.cmd run start
```

Then open:

```text
http://127.0.0.1:4174/
```

## Public deployment checklist

- Do not commit `.env`.
- Set `SOFASCORE_RAPIDAPI_KEY` as a secret environment variable on the hosting platform.
- Set `GENLAYER_CONTRACT_ADDRESS` as a secret environment variable on the hosting platform.
- Set `KEEPER_PRIVATE_KEY` as a secret environment variable if you want automatic resolution (see "Automatic resolution" above) — use a dedicated keeper wallet, not a personal one.
- Run `npm.cmd run build` before deployment.
- Start the app with `npm.cmd run start` or `node server.js`.
- Rotate any API key that was shared during development before publishing.

## Live test flow

1. Connect MetaMask or another injected wallet.
2. Select a live match from the market list.
3. Submit the bet condition.
4. Resolve after the match result is available.
