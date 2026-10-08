import { createClient } from "../../../lib/supabase/server";
import { emitInvitationEvent } from "../../../lib/realtime/server";

export async function DELETE(_request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Sign in to delete your invitation." }, { status: 401 });

  const { data, error } = await supabase
    .from("player_invitations")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return Response.json({ error: "Invitation could not be deleted." }, { status: 400 });
  if (!data) return Response.json({ error: "Invitation was not found." }, { status: 404 });

  emitInvitationEvent("invitation:deleted", { id: data.id, ownerId: user.id });
  return Response.json({ ok: true });
}
