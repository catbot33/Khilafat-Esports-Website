import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return Response.json({ error: "Enter your username and password." }, { status: 400 });
  }

  let email = identifier;
  if (!identifier.includes("@")) {
    const admin = createAdminClient();
    if (!admin) {
      return Response.json({ error: "Username login needs the Supabase service-role key in .env.local." }, { status: 503 });
    }

    const { data: alias } = await admin
      .from("user_login_aliases")
      .select("email")
      .ilike("username", identifier)
      .maybeSingle();

    if (!alias?.email) {
      return Response.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    email = alias.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  return Response.json({ ok: true });
}
