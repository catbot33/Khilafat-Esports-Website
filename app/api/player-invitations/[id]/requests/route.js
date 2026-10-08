import { createClient } from "../../../../lib/supabase/server";
import { valorantRanks } from "../../../../data/valorantRanks";
import { emitUserEvent } from "../../../../lib/realtime/server";

const ranks = new Set(valorantRanks);

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Sign in before asking to join." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const riotId = clean(body?.riotId, 32);
  const currentRank = clean(body?.currentRank, 20);
  const discordUsername = clean(body?.discordUsername, 40);

  if (!riotId.includes("#") || !ranks.has(currentRank) || !discordUsername) {
    return Response.json({ error: "Enter your Riot ID, current rank and Discord username." }, { status: 400 });
  }

  const { data: invitation } = await supabase
    .from("player_invitations")
    .select("id, owner_id")
    .eq("id", id)
    .eq("timing", "later")
    .eq("status", "Open")
    .maybeSingle();

  if (!invitation) {
    return Response.json({ error: "This invitation is no longer accepting requests." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("invitation_join_requests")
    .insert({
      invitation_id: id,
      requester_id: user.id,
      riot_id: riotId,
      current_rank: currentRank,
      discord_username: discordUsername,
    })
    .select("id, status")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return Response.json({ error: duplicate ? "You already asked to join this invitation." : "Your request could not be sent." }, { status: duplicate ? 409 : 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const realtimePayload = {
    invitationId: id,
    invitationOwnerId: invitation.owner_id,
    requesterId: user.id,
    applicant: {
      id: data.id,
      name: riotId,
      level: currentRank,
      role: discordUsername,
      username: profile?.username || "Player",
      status: data.status,
    },
  };

  emitUserEvent([invitation.owner_id, user.id], "request:created", realtimePayload);
  return Response.json({ id: data.id }, { status: 201 });
}
