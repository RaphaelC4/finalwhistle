import { deployContract } from "genlayer-js/chains";

export default async function main(client) {
  const contract = await deployContract(client, "contracts/FinalWhistleResolver.py", [
    "2026-05-09",
    "Arsenal",
    "Manchester City",
    "Arsenal will beat Manchester City by full time.",
    "https://www.bbc.com/sport/football/scores-fixtures/2026-05-09",
  ]);

  console.log("FinalWhistleResolver deployed:", contract);
}
