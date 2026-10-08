"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const nodeWidth = 280;
const nodeHeight = 118;
const columnGap = 152;
const rowGap = 32;
const roundLabelHeight = 76;

function roundTitle(round, totalRounds, format) {
  if (format === "Swiss") return `Swiss round ${round}`;
  if (format === "Round Robin") return `Matchday ${round}`;
  if (!totalRounds) return `Round ${round}`;
  const roundsRemaining = totalRounds - round;
  if (roundsRemaining === 0) return "Grand final";
  if (roundsRemaining === 1) return "Semifinals";
  if (roundsRemaining === 2) return "Quarterfinals";
  return `Round ${round}`;
}

function statusLabel(status) {
  if (status === "Completed") return "Final";
  if (status === "Pending") return "Awaiting teams";
  if (status === "Bye") return "Advances";
  if (status === "Scheduled") return "Scheduled";
  return status;
}

function standingsFor(event) {
  return [...event.participants].sort((a, b) => (
    (b.stats?.points || 0) - (a.stats?.points || 0)
    || (b.stats?.wins || 0) - (a.stats?.wins || 0)
    || a.seed - b.seed
  ));
}

function makeBracketLayout(event) {
  const roundMap = new Map();
  for (const match of event.matches) {
    if (!roundMap.has(match.round)) roundMap.set(match.round, []);
    roundMap.get(match.round).push(match);
  }

  if (event.format === "Swiss" && event.totalRounds) {
    const matchesPerRound = Math.ceil(event.participants.length / 2);
    for (let round = 1; round <= event.totalRounds; round += 1) {
      if (roundMap.has(round)) continue;
      roundMap.set(round, Array.from({ length: matchesPerRound }, (_, index) => ({
        id: `swiss-placeholder-r${round}-m${index + 1}`,
        stage: "Swiss rounds",
        round,
        order: index + 1,
        teamA: null,
        teamB: null,
        scoreA: null,
        scoreB: null,
        status: "Scheduled",
        isPlaceholder: true,
      })));
    }
  }

  const rounds = [...roundMap.entries()]
    .map(([number, matches]) => ({
      number,
      matches: matches.sort((a, b) => a.stage.localeCompare(b.stage) || a.order - b.order),
    }))
    .sort((a, b) => a.number - b.number);
  const positions = new Map();
  const isElimination = event.format === "Single Elimination" || event.format === "Double Elimination";

  rounds.forEach((round, roundIndex) => {
    const desiredPositions = round.matches.map((match, matchIndex) => {
      if (roundIndex === 0 || !isElimination) return matchIndex * (nodeHeight + rowGap);

      const explicitSources = [...new Set([match.sourceA, match.sourceB].filter(Boolean))]
        .map((id) => positions.get(id))
        .filter(Boolean);
      if (explicitSources.length > 0) {
        const averageCenter = explicitSources.reduce((sum, position) => sum + position.y + (nodeHeight / 2), 0) / explicitSources.length;
        return averageCenter - (nodeHeight / 2);
      }

      const previousRound = rounds[roundIndex - 1];
      const fallbackSources = previousRound.matches
        .slice(matchIndex * 2, (matchIndex * 2) + 2)
        .map((source) => positions.get(source.id))
        .filter(Boolean);
      if (fallbackSources.length > 0) {
        const averageCenter = fallbackSources.reduce((sum, position) => sum + position.y + (nodeHeight / 2), 0) / fallbackSources.length;
        return averageCenter - (nodeHeight / 2);
      }

      return matchIndex * (nodeHeight + rowGap);
    });

    let previousY = -nodeHeight - rowGap;
    round.matches.forEach((match, matchIndex) => {
      const y = Math.max(desiredPositions[matchIndex], previousY + nodeHeight + rowGap);
      positions.set(match.id, {
        x: roundIndex * (nodeWidth + columnGap),
        y: y + roundLabelHeight,
        roundIndex,
      });
      previousY = y;
    });
  });

  const connectors = [];
  if (isElimination) {
    for (const match of event.matches) {
      const target = positions.get(match.id);
      const sourceIds = [...new Set([match.sourceA, match.sourceB].filter(Boolean))];
      for (const sourceId of sourceIds) {
        const source = positions.get(sourceId);
        if (source && target && source.x < target.x) connectors.push({ source, target, key: `${sourceId}-${match.id}` });
      }
    }
  }

  const width = Math.max(nodeWidth, (rounds.length * nodeWidth) + (Math.max(0, rounds.length - 1) * columnGap));
  const height = Math.max(380, ...[...positions.values()].map((position) => position.y + nodeHeight + 34));
  return { rounds, matches: rounds.flatMap((round) => round.matches), positions, connectors, width, height };
}

function connectorPath({ source, target }) {
  const startX = source.x + nodeWidth;
  const startY = source.y + (nodeHeight / 2);
  const endX = target.x;
  const endY = target.y + (nodeHeight / 2);
  const bendX = startX + ((endX - startX) / 2);
  return `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`;
}

export default function LiveBracketView({ initialEvent }) {
  const [liveEvent, setLiveEvent] = useState(initialEvent);

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socket.on("live:update", (event) => setLiveEvent(event));
    return () => socket.disconnect();
  }, []);

  const participantMap = useMemo(() => new Map((liveEvent?.participants || []).map((participant) => [participant.id, participant])), [liveEvent]);
  const layout = useMemo(() => liveEvent ? makeBracketLayout(liveEvent) : null, [liveEvent]);

  if (!liveEvent) {
    return (
      <div className="live-page-empty">
        <span aria-hidden="true">K</span>
        <h2>No bracket is live</h2>
        <p>Return when the control panel launches the next tournament.</p>
        <a href="/">Back to home</a>
      </div>
    );
  }

  const showStandings = liveEvent.format === "Swiss" || liveEvent.format === "Round Robin";

  return (
    <div className="live-bracket-page">
      <header className="live-page-title">
        <div>
          <p className="section-kicker">{liveEvent.tournament?.game} · Live tournament</p>
          <h1>{liveEvent.tournament?.name}</h1>
        </div>
        <div className="live-page-status"><span aria-hidden="true" /><strong>Live</strong><small>{liveEvent.format}</small></div>
      </header>

      <section className="dedicated-bracket" aria-labelledby="bracket-title">
        <div className="dedicated-bracket-heading">
          <div><p className="section-kicker">{liveEvent.participants.length} competing teams</p><h2 id="bracket-title">Tournament bracket</h2></div>
          <span>Round {liveEvent.currentRound}{liveEvent.totalRounds ? ` of ${liveEvent.totalRounds}` : ""} · Updates instantly</span>
        </div>

        <div className="whole-bracket-scroll">
          <div className="whole-bracket-canvas" style={{ width: layout.width, height: layout.height }}>
            <svg aria-hidden="true" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
              <defs>
                <marker id="bracket-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
              {layout.connectors.map((connector) => <path d={connectorPath(connector)} markerEnd="url(#bracket-arrow)" key={connector.key} />)}
            </svg>

            {layout.rounds.map((round, roundIndex) => (
              <div className="whole-bracket-round" style={{ left: roundIndex * (nodeWidth + columnGap), width: nodeWidth, height: layout.height }} key={round.number}>
                <div className="whole-bracket-round-label">
                  <div><span>Round {String(round.number).padStart(2, "0")}</span><strong>{roundTitle(round.number, liveEvent.totalRounds, liveEvent.format)}</strong></div>
                  <small>{round.matches.length} {round.matches.length === 1 ? "pairing" : "pairings"}</small>
                </div>
              </div>
            ))}

            {layout.matches.map((match) => {
              const position = layout.positions.get(match.id);
              const teamA = participantMap.get(match.teamA);
              const teamB = participantMap.get(match.teamB);
              return (
                <article
                  className={`whole-bracket-match is-${match.status.toLowerCase()}${match.isPlaceholder ? " is-placeholder" : ""}`}
                  style={{ left: position.x, top: position.y, width: nodeWidth, minHeight: nodeHeight }}
                  key={match.id}
                >
                  <header><span>{match.stage}</span><strong><i aria-hidden="true" />{statusLabel(match.status)}</strong></header>
                  <div className={`bracket-team${match.winnerId && match.winnerId === match.teamA ? " is-winner" : ""}`}>
                    <em>{teamA?.seed ? String(teamA.seed).padStart(2, "0") : "—"}</em>
                    <span>{teamA?.name || (match.isPlaceholder ? "Pairing pending" : "To be decided")}</span>
                    <strong>{teamA && match.status !== "Bye" ? match.scoreA : "—"}</strong>
                  </div>
                  <div className={`bracket-team${match.winnerId && match.winnerId === match.teamB ? " is-winner" : ""}`}>
                    <em>{teamB?.seed ? String(teamB.seed).padStart(2, "0") : "—"}</em>
                    <span>{teamB?.name || (match.status === "Bye" ? "Bye" : match.isPlaceholder ? "Pairing pending" : "To be decided")}</span>
                    <strong>{teamB ? match.scoreB : "—"}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {showStandings && (
        <section className="dedicated-standings" aria-labelledby="standings-title">
          <div><p className="section-kicker">Current table</p><h2 id="standings-title">Standings</h2></div>
          <div className="live-standings">
            <div className="live-standings-head"><span>Team</span><span>Played</span><span>Wins</span><span>Points</span></div>
            {standingsFor(liveEvent).map((participant, index) => (
              <div key={participant.id}><strong>{index + 1}. {participant.name}</strong><span>{participant.stats?.played || 0}</span><span>{participant.stats?.wins || 0}</span><span>{participant.stats?.points || 0}</span></div>
            ))}
          </div>
        </section>
      )}

      {(liveEvent.youtubeUrl || liveEvent.discordUrl) && (
        <div className="live-watch-strip">
          <div><p className="section-kicker">Follow the tournament</p><strong>Watch the action or join the community.</strong></div>
          <div>
            {liveEvent.youtubeUrl && <a href={liveEvent.youtubeUrl} target="_blank" rel="noreferrer">Watch on YouTube <span aria-hidden="true">↗</span></a>}
            {liveEvent.discordUrl && <a href={liveEvent.discordUrl} target="_blank" rel="noreferrer">Join Discord <span aria-hidden="true">↗</span></a>}
          </div>
        </div>
      )}
    </div>
  );
}
