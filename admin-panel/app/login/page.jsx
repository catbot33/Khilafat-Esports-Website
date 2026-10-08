import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Admin Sign In | Khilafat Control",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership) redirect("/");
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span>K</span>
          <div>
            <strong>Khilafat</strong>
            <small>Private administration</small>
          </div>
        </div>

        <div className="login-copy">
          <p className="admin-kicker">Authorized personnel only</p>
          <h1 id="login-title">Enter Control</h1>
          <p>Sign in with the administrator account created in Supabase.</p>
        </div>

        <LoginForm />

        <p className="login-footnote">
          Access is checked against the private administrator list.
        </p>
      </section>

      <aside className="login-art" aria-hidden="true">
        <span>KHILAFAT</span>
        <div>
          <p>One arena.</p>
          <strong>Full control.</strong>
        </div>
      </aside>
    </main>
  );
}
