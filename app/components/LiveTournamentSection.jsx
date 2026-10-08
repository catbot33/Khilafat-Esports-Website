"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { io } from "socket.io-client";

function initials(name) {
  return (name || "TBD").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export default function LiveTournamentSection({ initialEvent }) {
  const [liveEvent, setLiveEvent] = useState(initialEvent);

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socket.on("live:update", (event) => setLiveEvent(event));
    return () => socket.disconnect();
  }, []);

  const participantMap = useMemo(() => new Map((liveEvent?.participants || []).map((participant) => [participant.id, participant])), [liveEvent]);
  const activeMatch = liveEvent?.matches.find((match) => match.id === liveEvent.activeMatchId)
    || liveEvent?.matches.find((match) => match.status === "Live")
    || liveEvent?.matches.find((match) => match.status === "Ready");

  return (
    <section className="live-section" id="live" aria-labelledby="live-title">
      <div className="live-heading">
        <div>
          <p className="section-kicker">Matches in progress</p>
          <h2 id="live-title">Live scores</h2>
        </div>
      </div>

      {!liveEvent ? (
        <div className="live-empty-state">
          <span aria-hidden="true">K</span>
          <div><strong>No tournament is live</strong><p>The next live score will appear here when a match begins.</p></div>
        </div>
      ) : (
        <div className="live-match-list">
          <article className="live-arena">
            <div className="live-arena-art" aria-hidden="true" />
            <div className="live-arena-topline">
              <div className="live-status"><span className="live-dot" aria-hidden="true" />Live</div>
              <div className="live-arena-meta"><span>{liveEvent.tournament?.game}</span><span>{liveEvent.tournament?.name}</span><span>Round {activeMatch?.round || liveEvent.currentRound}</span></div>
              <strong className="live-arena-round">{activeMatch?.stage || liveEvent.format}</strong>
            </div>

            {activeMatch ? (
              <div className="arena-scoreboard" aria-label={`${liveEvent.tournament?.game || "Tournament"} live score`}>
                <div className="arena-team">
                  <span className="arena-team-mark" aria-hidden="true">{initials(participantMap.get(activeMatch.teamA)?.name)}</span>
                  <div><span>Team one</span><strong>{participantMap.get(activeMatch.teamA)?.name || "Awaiting team"}</strong></div>
                </div>
                <div className="arena-scoreline"><strong>{activeMatch.scoreA}</strong><span aria-hidden="true">VS</span><strong>{activeMatch.scoreB}</strong></div>
                <div className="arena-team arena-team-away">
                  <div><span>Team two</span><strong>{participantMap.get(activeMatch.teamB)?.name || "Awaiting team"}</strong></div>
                  <span className="arena-team-mark" aria-hidden="true">{initials(participantMap.get(activeMatch.teamB)?.name)}</span>
                </div>
              </div>
            ) : <p className="live-between-matches">The next match is being prepared.</p>}

            <div className="live-arena-bottomline">
              <span>Scores update live</span>
              <i aria-hidden="true" />
              <Link className="live-bracket-link" href="/live">View full bracket <span aria-hidden="true">→</span></Link>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
