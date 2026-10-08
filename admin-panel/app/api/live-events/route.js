import { createBracketState, updateBracketMatch } from "../../lib/bracketEngine";
import { createClient } from "../../lib/supabase/server";

const liveEventSelect = "id,tournament_id,format,status,participants,matches,current_round,total_rounds,metadata,active_match_id,youtube_url,discord_url,updated_at,tournaments!inner(id,slug,name,game,format)";
const supportedFormats = new Set(["Single Elimination", "Double Elimination", "Swiss", "Round Robin"]);

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
    metadata: row.metadata || {},
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

function migrationError(error) {
  return error?.code === "42P01"
    || error?.code === "PGRST204"
    || /tournament_live_events|schema cache/i.test(error?.message || "");
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Sign in to the control panel." }, { status: 401 }) };

  const { data: membership } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: Response.json({ error: "Admin access is required." }, { status: 403 }) };
  return { supabase, user };
}

async function readEvent(supabase, id) {
  const { data, error } = await supabase
    .from("tournament_live_events")
    .select(liveEventSelect)
    .eq("id", id)
    .single();

  if (error) throw error;
  return mapLiveEvent(data);
}

async function makeOnlyLive(supabase, eventId) {
  const { error: pauseError } = await supabase
    .from("tournament_live_events")
    .update({ status: "Setup", active_match_id: null })
    .eq("status", "Live")
    .neq("id", eventId);
  if (pauseError) throw pauseError;
}

export async function POST(request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const { supabase, user } = access;
  const body = await request.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === "create") {
      const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
      const registrationIds = Array.isArray(body.registrationIds) ? [...new Set(body.registrationIds)] : [];
      if (!tournamentId || registrationIds.length < 2) {
        return Response.json({ error: "Choose a tournament and at least two entries." }, { status: 400 });
      }

      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .select("id,format")
        .eq("id", tournamentId)
        .single();
      if (tournamentError) throw tournamentError;
      if (!supportedFormats.has(tournament.format)) {
        return Response.json({ error: "This tournament needs a supported format before its bracket can be generated." }, { status: 400 });
      }

      const { data: entries, error: entriesError } = await supabase
        .from("tournament_registrations")
        .select("id,team_name,tournament_id")
        .eq("tournament_id", tournamentId)
        .in("id", registrationIds);
      if (entriesError) throw entriesError;
      if ((entries || []).length !== registrationIds.length) {
        return Response.json({ error: "One or more selected entries no longer exist." }, { status: 400 });
      }

      const entryById = new Map(entries.map((entry) => [entry.id, entry]));
      const orderedEntries = registrationIds.map((id) => entryById.get(id));
      const bracket = createBracketState(tournament.format, orderedEntries);

      const { data, error } = await supabase
        .from("tournament_live_events")
        .upsert({
          tournament_id: tournamentId,
          format: tournament.format,
          status: "Setup",
          participants: bracket.participants,
          matches: bracket.matches,
          current_round: bracket.currentRound,
          total_rounds: bracket.totalRounds,
          metadata: bracket.metadata,
          active_match_id: null,
          youtube_url: typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim().slice(0, 500) : "",
          discord_url: typeof body.discordUrl === "string" ? body.discordUrl.trim().slice(0, 500) : "",
          created_by: user.id,
        }, { onConflict: "tournament_id" })
        .select(liveEventSelect)
        .single();
      if (error) throw error;

      return Response.json({ liveEvent: mapLiveEvent(data) });
    }

    if (action === "launch") {
      const eventId = typeof body.eventId === "string" ? body.eventId : "";
      if (!eventId) return Response.json({ error: "Choose a generated tournament." }, { status: 400 });
      await makeOnlyLive(supabase, eventId);
      const { error } = await supabase
        .from("tournament_live_events")
        .update({ status: "Live" })
        .eq("id", eventId);
      if (error) throw error;
      return Response.json({ liveEvent: await readEvent(supabase, eventId) });
    }

    if (action === "score") {
      const eventId = typeof body.eventId === "string" ? body.eventId : "";
      const matchId = typeof body.matchId === "string" ? body.matchId : "";
      const nextStatus = body.matchStatus === "Completed" ? "Completed" : "Live";
      if (!eventId || !matchId) return Response.json({ error: "Choose a live event and match." }, { status: 400 });

      const current = await readEvent(supabase, eventId);
      const next = updateBracketMatch({
        format: current.format,
        status: current.status,
        participants: current.participants,
        matches: current.matches,
        currentRound: current.currentRound,
        totalRounds: current.totalRounds,
        activeMatchId: current.activeMatchId,
        metadata: current.metadata,
      }, matchId, body.scoreA, body.scoreB, nextStatus);

      if (next.status === "Live") await makeOnlyLive(supabase, eventId);
      const { error } = await supabase
        .from("tournament_live_events")
        .update({
          status: next.status,
          participants: next.participants,
          matches: next.matches,
          current_round: next.currentRound,
          total_rounds: next.totalRounds,
          metadata: next.metadata,
          active_match_id: next.activeMatchId,
        })
        .eq("id", eventId);
      if (error) throw error;

      return Response.json({ liveEvent: await readEvent(supabase, eventId) });
    }

    if (action === "remove") {
      const eventId = typeof body.eventId === "string" ? body.eventId : "";
      const { error } = await supabase.from("tournament_live_events").delete().eq("id", eventId);
      if (error) throw error;
      return Response.json({ removed: true, eventId });
    }

    return Response.json({ error: "Unknown live tournament action." }, { status: 400 });
  } catch (error) {
    if (migrationError(error)) {
      return Response.json({ error: "Run the live tournament engine migration in Supabase first." }, { status: 503 });
    }
    return Response.json({ error: error?.message || "Live tournament could not be updated." }, { status: 500 });
  }
}
