import SiteHeader from "../components/SiteHeader";
import LiveBracketView from "../components/LiveBracketView";
import { getLiveEvent } from "../data/getLiveEvent";

export const metadata = {
  title: "Live bracket | Khilafat Esports",
  description: "Follow the active Khilafat Esports tournament bracket, scores, and standings live.",
};

export default async function LivePage() {
  const liveEvent = await getLiveEvent();

  return (
    <main className="live-page-shell">
      <SiteHeader pageHeader />
      <div className="live-page-back"><a href="/"><span aria-hidden="true">←</span> Back to home</a></div>
      <LiveBracketView initialEvent={liveEvent} />
      <footer className="detail-footer"><p>© 2026 Khilafat Esports</p><a href="/tournaments">Browse tournaments <span aria-hidden="true">→</span></a></footer>
    </main>
  );
}
