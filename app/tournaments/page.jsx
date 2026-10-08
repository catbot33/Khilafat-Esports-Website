import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import TournamentDirectory from "../components/TournamentDirectory";
import { getPublishedTournaments } from "../data/getTournaments";

export const metadata = {
  title: "Tournaments | Khilafat Esports",
  description: "Browse Khilafat Esports tournaments.",
};

const communityLinks = {
  discord: "https://discord.com/",
  youtube: "https://www.youtube.com/",
};

export default async function TournamentsPage() {
  const upcomingTournaments = await getPublishedTournaments();

  return (
    <main className="tournaments-page" id="top">
      <SiteHeader pageHeader />

      <section className="tournaments-page-hero" aria-labelledby="tournaments-page-title">
        <a className="page-back-link" href="/">
          <span aria-hidden="true">←</span> Back home
        </a>

        <div className="tournaments-page-title">
          <div>
            <p className="section-kicker">Tournament calendar</p>
            <h1 id="tournaments-page-title">Tournaments</h1>
          </div>
        </div>
      </section>

      <section className="directory-section" aria-label="Tournament directory">
        <TournamentDirectory tournaments={upcomingTournaments} />
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <a className="footer-brand" href="/#top" aria-label="Khilafat Esports home">
            <Image
              src="/images/khilafat-logo.svg"
              alt="Khilafat Esports"
              width={150}
              height={50}
            />
          </a>

          <div className="footer-column">
            <p className="footer-title">Navigate</p>
            <nav className="footer-links" aria-label="Footer navigation">
              <a href="/tournaments">Tournaments</a>
              <a href="/#live">Live scores</a>
              <a href="/looking-for-player">Looking for player</a>
            </nav>
          </div>

          <div className="footer-column">
            <p className="footer-title">Community</p>
            <div className="footer-links">
              <a className="footer-social-link" href={communityLinks.discord} target="_blank" rel="noreferrer">
                <span className="footer-social-icon" aria-hidden="true">
                  <Image src="/images/discord-logo.png" alt="" width={24} height={18} />
                </span>
                Discord
                <span aria-hidden="true">↗</span>
              </a>
              <a className="footer-social-link" href={communityLinks.youtube} target="_blank" rel="noreferrer">
                <span className="footer-social-icon" aria-hidden="true">
                  <Image src="/images/youtube-logo.png" alt="" width={24} height={18} />
                </span>
                YouTube
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <div className="footer-column">
            <p className="footer-title">Legal</p>
            <nav className="footer-links" aria-label="Legal navigation">
              <a href="/privacy-policy">Privacy policy</a>
              <a href="/terms-of-service">Terms of service</a>
            </nav>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">© 2026 Khilafat Esports</p>
          <a className="back-to-top" href="#top">
            Back to top <span aria-hidden="true">↑</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
