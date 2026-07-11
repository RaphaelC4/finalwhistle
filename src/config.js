import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";

export const chainMap = {
  localnet: localnet,
  studionet: studionet,
  testnetBradbury: testnetAsimov,
};

export const networkLabels = {
  localnet: "GenLayer localnet",
  studionet: "GenLayer studionet",
  testnetBradbury: "GenLayer testnet Bradbury",
};

export const oddsSources = [
  { name: "Pitchside Odds", variance: 4 },
  { name: "Kickoff Markets", variance: -3 },
  { name: "Fulltime Exchange", variance: 2 },
  { name: "FinalWhistle AI", variance: 0, isAi: true },
];

export const prestigeTerms = [
  "premier league", "champions league", "europa league", "la liga",
  "serie a", "bundesliga", "ligue 1", "fa cup", "carabao cup",
  "arsenal", "chelsea", "liverpool", "manchester united", "man united",
  "manchester city", "man city", "tottenham", "newcastle", "real madrid",
  "barcelona", "atletico", "bayern", "dortmund", "leverkusen",
  "psg", "marseille", "inter", "milan", "juventus", "napoli", "roma",
  "ajax", "psv", "benfica", "porto", "sporting", "celtic", "rangers",
  "sevilla", "espanyol", "almeria",
];
