function mapTournament(row) {
  const start = new Date(row.start_at);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);

  return {
    id: row.slug,
    slug: row.slug,
    databaseId: row.id,
    name: row.name,
    description: row.description ?? "",
    game: row.game,
    image: row.image_url,
    date,
    time: `${time} PKT`,
    format: row.format,
    teamSize: Number(row.team_size) || 5,
    status: row.status,
    prize: row.prize,
    regionServer: row.region_server ?? "",
    variant: row.tournament_variant ?? "",
    mapName: row.map_name ?? "",
  };
}

export async function getPublishedTournaments() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!projectUrl || !publishableKey) return [];

  try {
    const query = new URLSearchParams({
      select: "id,slug,name,description,game,start_at,format,team_size,status,prize,region_server,tournament_variant,map_name,image_url",
      visibility: "eq.Published",
      order: "start_at.asc",
    });
    const response = await fetch(`${projectUrl}/rest/v1/tournaments?${query}`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return [];

    const tournaments = await response.json();
    return tournaments.map(mapTournament);
  } catch {
    return [];
  }
}

export async function getPublishedTournament(slug) {
  const tournaments = await getPublishedTournaments();
  return tournaments.find((tournament) => tournament.slug === slug || tournament.id === slug) ?? null;
}
