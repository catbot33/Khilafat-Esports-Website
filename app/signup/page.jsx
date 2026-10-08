import Image from "next/image";
import Link from "next/link";
import AuthPanel from "../components/AuthPanel";
import SiteHeader from "../components/SiteHeader";
import { createClient } from "../lib/supabase/server";

export const metadata = {
  title: "Player Account | Khilafat Esports",
  description: "Create or access your Khilafat Esports player account.",
};

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  const requestedNext = typeof params?.next === "string" ? params.next : "/looking-for-player";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/looking-for-player";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let currentUser = null;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
    currentUser = { username: profile?.username || user.user_metadata?.username || user.email?.split("@")[0] || "Player" };
  }

  return (
    <main className="auth-page" id="top">
      <SiteHeader pageHeader />
      <div className="auth-page-backdrop" aria-hidden="true">
        <Image src="/images/hero-golden-shadow-emblem.png" alt="" width={700} height={700} priority />
      </div>
      <section className="auth-page-layout" aria-label="Player account">
        <div className="auth-page-intro">
          <Link className="page-back-link" href="/"><span aria-hidden="true">←</span> Back home</Link>
          <p className="section-kicker">One identity</p>
          <h2>Your stack stays with you.</h2>
          <p>Create invitations, receive player requests and return to your saved activity from any device.</p>
          <div className="auth-benefits" aria-label="Account benefits">
            <span>Saved invitations</span>
            <span>Player requests</span>
            <span>Secure sign-in</span>
          </div>
        </div>
        <AuthPanel initialMode={params?.mode === "login" ? "login" : "signup"} next={next} currentUser={currentUser} />
      </section>
    </main>
  );
}
