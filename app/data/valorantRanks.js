export const valorantRankGroups = [
  { tier: "Placement", divisions: ["Unranked"] },
  { tier: "Iron", divisions: ["Iron 1", "Iron 2", "Iron 3"] },
  { tier: "Bronze", divisions: ["Bronze 1", "Bronze 2", "Bronze 3"] },
  { tier: "Silver", divisions: ["Silver 1", "Silver 2", "Silver 3"] },
  { tier: "Gold", divisions: ["Gold 1", "Gold 2", "Gold 3"] },
  { tier: "Platinum", divisions: ["Platinum 1", "Platinum 2", "Platinum 3"] },
  { tier: "Diamond", divisions: ["Diamond 1", "Diamond 2", "Diamond 3"] },
  { tier: "Ascendant", divisions: ["Ascendant 1", "Ascendant 2", "Ascendant 3"] },
  { tier: "Immortal", divisions: ["Immortal 1", "Immortal 2", "Immortal 3"] },
  { tier: "Radiant", divisions: ["Radiant"] },
];

export const valorantRanks = valorantRankGroups.flatMap((group) => group.divisions);
