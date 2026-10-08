import { redirect } from "next/navigation";
import ValorantAdminDashboard from "./components/ValorantAdminDashboard";
import { createClient } from "./lib/supabase/server";
import { mapTournamentRow } from "./lib/tournaments";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/login");

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, game, start_at, format, team_size, status, prize, image_url, visibility, featured")
    .order("start_at", { ascending: true });

  const { data: registrationRows, error: registrationError } = await supabase
    .from("tournament_registrations")
    .select("id, tournament_id, team_name, discord_name, riot_id, current_rank, entry_type, needs_teammate, teammates, status, created_at, tournaments!inner(id, name, game, team_size)")
    .order("created_at", { ascending: false });

  const { data: liveRows, error: liveError } = await supabase
    .from("tournament_live_events")
    .select("id,tournament_id,format,status,participants,matches,current_round,total_rounds,metadata,active_match_id,youtube_url,discord_url,updated_at,tournaments!inner(id,slug,name,game,format)")
    .order("updated_at", { ascending: false });

  const registrations = (registrationRows ?? []).map((row) => ({
    id: row.id,
    tournamentId: row.tournament_id,
    teamName: row.team_name,
    discordName: row.discord_name,
    riotId: row.riot_id,
    currentRank: row.current_rank,
    entryType: row.entry_type,
    needsTeammate: row.needs_teammate,
    teammates: Array.isArray(row.teammates) ? row.teammates : [],
    status: row.status,
    createdAt: row.created_at,
    tournament: row.tournaments,
  }));

  const liveEvents = (liveRows ?? []).map((row) => ({
    id: row.id,
    tournamentId: row.tournament_id,
    format: row.format,
    status: row.status,
    participants: Array.isArray(row.participants) ? row.participants : [],
    matches: Array.isArray(row.matches) ? row.matches : [],
    currentRound: row.current_round,
    totalRounds: row.total_rounds,
    metadata: row.metadata || {},
    activeMatchId: row.active_match_id,
    youtubeUrl: row.youtube_url || "",
    discordUrl: row.discord_url || "",
    updatedAt: row.updated_at,
    tournament: Array.isArray(row.tournaments) ? row.tournaments[0] : row.tournaments,
  }));

  return (
    <ValorantAdminDashboard
      initialTournaments={(data ?? []).map(mapTournamentRow)}
      initialRegistrations={registrations}
      initialLiveEvents={liveEvents}
      liveDatabaseReady={!liveError}
      user={{ id: user.id, email: user.email }}
      initialError={error?.message ?? (registrationError ? "Entries need database setup. Run the tournament registrations migration in Supabase." : "")}
    />
  );
}
