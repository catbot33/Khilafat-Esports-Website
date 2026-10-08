function mapLiveEvent(row) {
  const tournament = Array.isArray(row.tournaments) ? row.tournaments[0] : row.tournaments;
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    format: row.format,
    status: row.status,
    participants: Array.isArray(row.participants) ? row.participants : [],
    matches: Array.isArray(row.matches) ? row.matches : [],
    currentRound: row.current_round,
    totalRounds: row.total_rounds,
    activeMatchId: row.active_match_id,
    youtubeUrl: row.youtube_url || "",
    discordUrl: row.discord_url || "",
    updatedAt: row.updated_at,
    tournament: tournament ? {
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
      game: tournament.game,
      format: tournament.format,
    } : null,
  };
}

export async function getLiveEvent() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl || !publishableKey) return null;

  try {
    const query = new URLSearchParams({
      select: "id,tournament_id,format,status,participants,matches,current_round,total_rounds,active_match_id,youtube_url,discord_url,updated_at,tournaments!inner(id,slug,name,game,format)",
      status: "eq.Live",
      order: "updated_at.desc",
      limit: "1",
    });
    const response = await fetch(`${projectUrl}/rest/v1/tournament_live_events?${query}`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return rows[0] ? mapLiveEvent(rows[0]) : null;
  } catch {
    return null;
  }
}
