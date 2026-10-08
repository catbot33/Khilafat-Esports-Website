function datePartsInPakistan(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function mapTournamentRow(row) {
  const parts = datePartsInPakistan(row.start_at);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    game: row.game,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    format: row.format,
    variant: row.tournament_variant ?? "",
    teamSize: Number(row.team_size) || 5,
    mapName: row.map_name ?? "",
    status: row.status,
    prize: row.prize,
    regionServer: row.region_server ?? "",
    image: row.image_url,
    visibility: row.visibility,
    featured: row.featured,
  };
}
