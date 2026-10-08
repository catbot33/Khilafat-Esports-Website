import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

const usernamePattern = /^[a-zA-Z0-9_.-]{3,24}$/;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!usernamePattern.test(username)) {
    return Response.json({ error: "Use 3–24 letters, numbers, dots, dashes or underscores for your username." }, { status: 400 });
  }

  if (!email.includes("@") || password.length < 8) {
    return Response.json({ error: "Enter a valid email and a password with at least 8 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ error: "Account signup needs the Supabase service-role key in .env.local." }, { status: 503 });
  }

  const { data: existingAlias } = await admin
    .from("user_login_aliases")
    .select("user_id")
    .ilike("username", username)
    .maybeSingle();

  if (existingAlias) {
    return Response.json({ error: "That username is already taken." }, { status: 409 });
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/looking-for-player`,
    },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
    signedIn: Boolean(data.session),
    message: data.session ? "Your account is ready." : "Check your email to confirm your account.",
  });
}
