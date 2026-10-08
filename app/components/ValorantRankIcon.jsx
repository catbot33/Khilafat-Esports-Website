const rankColumns = {
  Iron: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
  Ascendant: 6,
  Immortal: 7,
  Radiant: 8,
};

export default function ValorantRankIcon({ rank, compact = false }) {
  const match = typeof rank === "string"
    ? rank.match(/^(Iron|Bronze|Silver|Gold|Platinum|Diamond|Ascendant|Immortal|Radiant)(?:\s+([123]))?$/)
    : null;

  if (!match) return <span className={`valorant-rank-icon is-unranked${compact ? " is-compact" : ""}`} aria-hidden="true">?</span>;

  const tier = match[1];
  const division = tier === "Radiant" ? 2 : Number(match[2] || 1);
  const row = 3 - division;

  return (
    <span
      className={`valorant-rank-icon${compact ? " is-compact" : ""}`}
      style={{ "--rank-column": rankColumns[tier], "--rank-row": row }}
      role="img"
      aria-label={`${rank} rank icon`}
    />
  );
}
