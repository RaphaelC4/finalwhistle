# FinalWhistle AI

AI football prediction and bet-resolution demo for the GenLayer Builder Program.

## What is included

- Wallet connection in the frontend.
- Server-side contract configuration for live testing.
- GenLayer intelligent contract: `contracts/FinalWhistleResolver.py`.
- Real football match feed with provider logos when available.
- Contract-ready selected match flow for GenLayer resolution.

## Live football data

The app uses API-Football as the primary production data provider through a local backend proxy:

```text
/api/fixtures?date=YYYY-MM-DD&timezone=Africa/Lagos
```

Get a free key from:

```text
https://dashboard.api-football.com/
```

Put the key in `.env`:

```text
API_FOOTBALL_KEY=your_key_here
PORT=4174
```

The browser never receives the API key. The Node server calls API-Football with the secret header and returns only fixture data to the frontend.

If the API-Football proxy is unavailable, the app falls back to:

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
- Set `API_FOOTBALL_KEY` as a secret environment variable on the hosting platform.
- Set `GENLAYER_CONTRACT_ADDRESS` as a secret environment variable on the hosting platform.
- Run `npm.cmd run build` before deployment.
- Start the app with `npm.cmd run start` or `node server.js`.
- Rotate any API key that was shared during development before publishing.

## Live test flow

1. Connect MetaMask or another injected wallet.
2. Select a live match from the market list.
3. Submit the bet condition.
4. Resolve after the match result is available.
