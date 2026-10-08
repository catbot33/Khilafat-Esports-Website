import Image from "next/image";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import ValorantRegistrationForm from "../../components/ValorantRegistrationForm";
import { getPublishedTournament } from "../../data/getTournaments";
import { createClient } from "../../lib/supabase/server";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tournament = await getPublishedTournament(slug);

  if (!tournament) return { title: "Tournament not found | Khilafat Esports" };

  return {
    title: `${tournament.name} | Khilafat Esports`,
    description: tournament.description || `${tournament.game} tournament details and registration.`,
  };
}

export default async function TournamentDetailsPage({ params }) {
  const { slug } = await params;
  const tournament = await getPublishedTournament(slug);

  if (!tournament) notFound();

  const isValorant = tournament.game === "Valorant";
  const registrationOpen = isValorant && tournament.status === "Registration open";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let existingRegistration = null;

  if (user && tournament.databaseId) {
    const { data } = await supabase
      .from("tournament_registrations")
      .select("id, status, created_at")
      .eq("tournament_id", tournament.databaseId)
      .eq("user_id", user.id)
      .maybeSingle();
    existingRegistration = data;
  }
  const details = [
    ["Date", tournament.date],
    ["Time", tournament.time],
    ["Format", tournament.format],
    ["Team size", `${tournament.teamSize || 5}v${tournament.teamSize || 5}`],
    ["Prize pool", tournament.prize],
    ["Region / server", tournament.regionServer || "To be announced"],
    ["Variant", tournament.variant || "Standard"],
    ...(tournament.variant === "Gauntlet: Glitched" ? [] : [["Map", tournament.mapName || "To be announced"]]),
  ];

  return (
    <main className="tournament-detail-page" id="top">
      <SiteHeader pageHeader />

      <section className="tournament-detail-hero" aria-labelledby="tournament-title">
        <Image
          src={tournament.image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="tournament-detail-image"
        />
        <div className="tournament-detail-shade" />
        <div className="tournament-detail-hero-content">
          <a className="page-back-link" href="/tournaments"><span aria-hidden="true">←</span> All tournaments</a>
          <div className="tournament-detail-title-row">
            <div>
              <p className="section-kicker">{tournament.game} tournament</p>
              <h1 id="tournament-title">{tournament.name}</h1>
            </div>
            <span className={`tournament-detail-status${registrationOpen ? " is-open" : ""}`}>{tournament.status}</span>
          </div>
        </div>
      </section>

      <section className="tournament-detail-content">
        <div className="tournament-overview">
          <p className="section-kicker">Tournament brief</p>
          <h2>Enter the arena</h2>
          <p className="tournament-description">{tournament.description || "Tournament information will be announced by Khilafat Esports."}</p>

          <dl className="tournament-detail-grid">
            {details.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>

          <div className="tournament-note">
            <span aria-hidden="true">K</span>
            <p>Entries are reviewed by Khilafat Esports. Further tournament instructions will be sent through Discord.</p>
          </div>
        </div>

        <aside className="registration-panel" id="register">
          <p className="section-kicker">Team entry</p>
          <h2>{isValorant ? "Register your entry" : "Registration coming soon"}</h2>
          {isValorant ? (
            <ValorantRegistrationForm
              tournament={tournament}
              registrationOpen={registrationOpen}
              isAuthenticated={Boolean(user)}
              existingRegistration={existingRegistration}
            />
          ) : (
            <p className="registration-availability">Player submission is currently available for Valorant tournaments only.</p>
          )}
        </aside>
      </section>

      <footer className="detail-footer">
        <p>© 2026 Khilafat Esports</p>
        <a href="/tournaments">Browse tournaments <span aria-hidden="true">→</span></a>
      </footer>
    </main>
  );
}
