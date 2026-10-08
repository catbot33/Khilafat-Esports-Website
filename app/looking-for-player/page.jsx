import Image from "next/image";
import Link from "next/link";
import InvitationBoard from "../components/InvitationBoard";
import SiteHeader from "../components/SiteHeader";
import { getPlayerInvitationData } from "../data/getPlayerInvitations";

export const metadata = {
  title: "Looking to Play | Khilafat Esports",
  description: "Find players, join a stack, or create a gaming invitation.",
};

const communityLinks = {
  discord: "https://discord.com/",
  youtube: "https://www.youtube.com/",
};

export default async function LookingForPlayerPage() {
  const { invitations, user, databaseReady } = await getPlayerInvitationData();

  return (
    <main className="looking-page" id="top">
      <SiteHeader pageHeader />

      <section className="looking-page-hero" aria-labelledby="looking-page-title">
        <Link className="page-back-link" href="/">
          <span aria-hidden="true">←</span> Back home
        </Link>

        <div className="looking-page-title">
          <div>
            <p className="section-kicker">Find your stack</p>
            <h1 id="looking-page-title">Looking to play</h1>
          </div>

        </div>
      </section>

      <section className="invitation-section" aria-label="Player invitations">
        <InvitationBoard initialInvitations={invitations} currentUser={user} databaseReady={databaseReady} />
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <Link className="footer-brand" href="/#top" aria-label="Khilafat Esports home">
            <Image src="/images/khilafat-logo.svg" alt="Khilafat Esports" width={150} height={50} />
          </Link>

          <div className="footer-column">
            <p className="footer-title">Navigate</p>
            <nav className="footer-links" aria-label="Footer navigation">
              <Link href="/tournaments">Tournaments</Link>
              <Link href="/#live">Live scores</Link>
              <Link href="/looking-for-player">Looking for player</Link>
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
              <Link href="/privacy-policy">Privacy policy</Link>
              <Link href="/terms-of-service">Terms of service</Link>
            </nav>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">© 2026 Khilafat Esports</p>
          <Link className="back-to-top" href="#top">
            Back to top <span aria-hidden="true">↑</span>
          </Link>
        </div>
      </footer>
    </main>
  );
}
