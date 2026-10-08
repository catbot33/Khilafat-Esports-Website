import Image from "next/image";
import SiteHeader from "./components/SiteHeader";
import TournamentCarousel from "./components/TournamentCarousel";
import LiveTournamentSection from "./components/LiveTournamentSection";
import { getLiveEvent } from "./data/getLiveEvent";
import { getPublishedTournaments } from "./data/getTournaments";

const tournaments = [
  {
    name: "Valorant",
    image: "/images/valorant-tournament-v2.png",
  },
  {
    name: "CS2",
    image: "/images/cs2-tournament.png",
  },
  {
    name: "Chess",
    image: "/images/chess-tournament.png",
  },
  {
    name: "Roblox",
    image: "/images/roblox-tournament.png",
  },
];

const communityLinks = {
  discord: "https://discord.com/",
  youtube: "https://www.youtube.com/",
};

export default async function Home() {
  const [upcomingTournaments, liveEvent] = await Promise.all([
    getPublishedTournaments(),
    getLiveEvent(),
  ]);

  return (
    <main className="site-shell">
      <SiteHeader />

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true" />

        <div className="hero-lower">
          <div className="hero-copy">
            <h1 id="hero-title">Khilafat Esports</h1>
            <p className="hero-tagline">Compete to become the best</p>
            <a className="tournament-button" href="/tournaments">
              Tournaments
            </a>
          </div>

          <div
            className="tournaments"
            id="tournaments"
            aria-label="Tournament games"
          >
            <TournamentCarousel tournaments={tournaments} />
          </div>
        </div>
      </section>

      <LiveTournamentSection initialEvent={liveEvent} />

      {upcomingTournaments.length > 0 && <section className="upcoming-section" aria-labelledby="upcoming-title">
        <div className="upcoming-heading">
          <div>
            <p className="section-kicker">Published events</p>
            <h2 id="upcoming-title">Tournaments</h2>
          </div>

          <a className="view-all-link" href="/tournaments">
            View all tournaments <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="upcoming-grid">
          {upcomingTournaments.slice(0, 3).map((tournament) => (
            <article className="upcoming-card" key={tournament.name}>
              <a className="upcoming-card-media" href={`/tournaments/${tournament.slug}`}>
                <Image
                  src={tournament.image}
                  alt={`${tournament.game} tournament`}
                  fill
                  sizes="(max-width: 820px) 100vw, 33vw"
                />
                <span className="upcoming-date">{tournament.date}</span>
              </a>

              <div className="upcoming-card-body">
                <p className="upcoming-game">{tournament.game}</p>
                <h3>{tournament.name}</h3>

                <div className="upcoming-meta">
                  <span>{tournament.format}</span>
                  <span>{tournament.status}</span>
                </div>

                <a className="upcoming-card-link" href={`/tournaments/${tournament.slug}`}>
                  Tournament details <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>}

      <section className="community-section" id="community" aria-labelledby="community-title">
        <div className="community-inner">
          <a
            className="community-video"
            href={communityLinks.youtube}
            target="_blank"
            rel="noreferrer"
            aria-label="Watch Khilafat Esports community videos on YouTube"
          >
            <span className="video-label">Community spotlight</span>
            <span className="video-play" aria-hidden="true">▶</span>
            <span className="video-caption">
              <strong>Watch the latest from the arena</strong>
            </span>
          </a>

          <div className="community-copy">
            <p className="section-kicker">Join the community</p>
            <h2 id="community-title">Play together. Rise together.</h2>

            <div className="community-actions">
              <a
                className="community-button discord-button"
                href={communityLinks.discord}
                target="_blank"
                rel="noreferrer"
              >
                <span className="social-logo-wrap" aria-hidden="true">
                  <Image
                    className="social-logo discord-logo"
                    src="/images/discord-logo.png"
                    alt=""
                    width={38}
                    height={28}
                  />
                </span>
                <span className="community-button-copy">
                  <strong>Join Discord</strong>
                </span>
                <span className="external-arrow" aria-hidden="true">↗</span>
              </a>

              <a
                className="community-button youtube-button"
                href={communityLinks.youtube}
                target="_blank"
                rel="noreferrer"
              >
                <span className="social-logo-wrap youtube-logo-wrap" aria-hidden="true">
                  <Image
                    className="social-logo youtube-logo"
                    src="/images/youtube-logo.png"
                    alt=""
                    width={38}
                    height={28}
                  />
                </span>
                <span className="community-button-copy">
                  <strong>Visit YouTube</strong>
                </span>
                <span className="external-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <a className="footer-brand" href="#top" aria-label="Khilafat Esports home">
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
              <a href="#live">Live scores</a>
              <a href="/looking-for-player">Looking for player</a>
            </nav>
          </div>

          <div className="footer-column">
            <p className="footer-title">Community</p>
            <div className="footer-links">
              <a
                className="footer-social-link"
                href={communityLinks.discord}
                target="_blank"
                rel="noreferrer"
              >
                <span className="footer-social-icon" aria-hidden="true">
                  <Image src="/images/discord-logo.png" alt="" width={24} height={18} />
                </span>
                Discord
                <span aria-hidden="true">↗</span>
              </a>
              <a
                className="footer-social-link"
                href={communityLinks.youtube}
                target="_blank"
                rel="noreferrer"
              >
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
