import { createClient } from "../../lib/supabase/server";
import { valorantRanks } from "../../data/valorantRanks";
import { emitInvitationEvent } from "../../lib/realtime/server";

const ranks = new Set(valorantRanks);
const modes = new Set([
  "Competitive",
  "Unrated",
  "Swiftplay",
  "Premier",
  "Spike Rush",
  "Team Deathmatch",
  "Skirmish",
  "Gauntlet: Glitched",
]);

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function formatPlayTime(value) {
  if (!value) return "Time not set";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Sign in to create an invitation." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const timing = body?.timing === "later" ? "later" : "now";
  const title = clean(body?.title, 72);
  const message = clean(body?.message, 220);
  const riotId = clean(body?.host, 32);
  const currentRank = clean(body?.level, 20);
  const regionServer = clean(body?.region, 100);
  const gameMode = clean(body?.mode, 32);
  const partyCode = timing === "now" ? clean(body?.partyCode, 32) : null;
  const discordUsername = timing === "later" ? clean(body?.discord, 40) : null;
  const playAt = timing === "later" && body?.time ? new Date(body.time) : null;

  if (!title || !message || !riotId.includes("#") || !ranks.has(currentRank) || !regionServer || !modes.has(gameMode)) {
    return Response.json({ error: "Complete every invitation field with a valid Riot ID and rank." }, { status: 400 });
  }

  if ((timing === "now" && !partyCode) || (timing === "later" && (!discordUsername || !playAt || Number.isNaN(playAt.getTime())))) {
    return Response.json({ error: timing === "now" ? "Add your VALORANT party code." : "Add your Discord username and playing time." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("player_invitations")
    .insert({
      owner_id: user.id,
      game: "Valorant",
      title,
      message,
      riot_id: riotId,
      current_rank: currentRank,
      region_server: regionServer,
      game_mode: gameMode,
      timing,
      party_code: partyCode,
      discord_username: discordUsername,
      play_at: playAt?.toISOString() || null,
    })
    .select("id, owner_id, game, title, message, riot_id, current_rank, region_server, game_mode, timing, party_code, discord_username, play_at, status, created_at")
    .single();

  if (error) {
    return Response.json({ error: "Invitation could not be saved. Run the player accounts migration in Supabase." }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const invitation = {
    id: data.id,
    ownerId: data.owner_id,
    game: data.game,
    title: data.title,
    message: data.message,
    host: data.riot_id,
    creator: profile?.display_name || profile?.username || "Player",
    level: data.current_rank,
    region: data.region_server,
    mode: data.game_mode,
    timing: data.timing,
    partyCode: data.party_code || "",
    discord: data.discord_username || "",
    time: data.timing === "now" ? "Playing now" : formatPlayTime(data.play_at),
    playAt: data.play_at,
    status: data.status,
    requestSent: false,
    requestStatus: null,
    applicants: [],
  };

  emitInvitationEvent("invitation:created", invitation);
  return Response.json({ invitation, createdAt: data.created_at }, { status: 201 });
}
