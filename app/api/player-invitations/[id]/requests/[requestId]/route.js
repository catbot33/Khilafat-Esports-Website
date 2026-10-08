import { createClient } from "../../../../../lib/supabase/server";
import { emitUserEvent } from "../../../../../lib/realtime/server";

export async function PATCH(request, context) {
  const { id, requestId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Sign in to manage join requests." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const status = body?.status === "Accepted" ? "Accepted" : body?.status === "Declined" ? "Declined" : "";
  if (!status) return Response.json({ error: "Choose Accepted or Declined." }, { status: 400 });

  const { data: invitation } = await supabase
    .from("player_invitations")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!invitation) return Response.json({ error: "Only the invitation creator can manage requests." }, { status: 403 });

  const { data: joinRequest, error } = await supabase
    .from("invitation_join_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("invitation_id", id)
    .select("id, requester_id, status")
    .single();

  if (error) return Response.json({ error: "Request status could not be updated." }, { status: 400 });

  emitUserEvent([user.id, joinRequest.requester_id], "request:updated", {
    invitationId: id,
    invitationOwnerId: user.id,
    requesterId: joinRequest.requester_id,
    requestId: joinRequest.id,
    status: joinRequest.status,
  });
  return Response.json({ ok: true });
}
