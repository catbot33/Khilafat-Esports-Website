import { createClient } from "../lib/supabase/server";
import { playerInvitations as fallbackInvitations } from "./invitations";

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

function fallbackResult(user = null) {
  return {
    user,
    databaseReady: false,
    invitations: fallbackInvitations.map((invitation) => ({
      ...invitation,
      owned: false,
      applicants: [],
      requestSent: false,
    })),
  };
}

export async function getPlayerInvitationData() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return fallbackResult();
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let user = null;

  if (authUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();

    user = {
      id: authUser.id,
      username: profile?.username || authUser.user_metadata?.username || authUser.email?.split("@")[0] || "Player",
      displayName: profile?.display_name || authUser.user_metadata?.full_name || "Player",
      avatarUrl: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
    };
  }

  const { data: rows, error } = await supabase
    .from("player_invitations")
    .select(`
      id,
      owner_id,
      game,
      title,
      message,
      riot_id,
      current_rank,
      region_server,
      game_mode,
      timing,
      party_code,
      discord_username,
      play_at,
      status,
      created_at,
      owner:profiles!player_invitations_owner_id_fkey(username, display_name, avatar_url),
      applicants:invitation_join_requests(
        id,
        requester_id,
        riot_id,
        current_rank,
        discord_username,
        status,
        requester:profiles!invitation_join_requests_requester_id_fkey(username)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) return fallbackResult(user);

  return {
    user,
    databaseReady: true,
    invitations: (rows || []).map((row) => {
      const currentUserRequest = (row.applicants || []).find((request) => request.requester_id === authUser?.id);

      return {
        id: row.id,
        owned: row.owner_id === authUser?.id,
        game: row.game,
        title: row.title,
        message: row.message,
        host: row.riot_id,
        creator: row.owner?.display_name || row.owner?.username || "Player",
        level: row.current_rank,
        region: row.region_server,
        mode: row.game_mode,
        timing: row.timing,
        partyCode: row.party_code || "",
        discord: row.discord_username || "",
        time: row.timing === "now" ? "Playing now" : formatPlayTime(row.play_at),
        playAt: row.play_at,
        status: row.status,
        requestSent: Boolean(currentUserRequest),
        requestStatus: currentUserRequest?.status || null,
        applicants: (row.applicants || []).map((request) => ({
          id: request.id,
          name: request.riot_id,
          level: request.current_rank,
          role: request.discord_username,
          username: request.requester?.username || "Player",
          status: request.status,
        })),
      };
    }),
  };
}
