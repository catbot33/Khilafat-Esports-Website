"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function TournamentDirectory({ tournaments }) {
  const [activeGame, setActiveGame] = useState("All");
  const games = useMemo(() => {
    const availableGames = new Set(tournaments.map((tournament) => tournament.game));

    return ["All", "Valorant", "CS2", "Chess", "Roblox"].filter(
      (game) => game === "All" || availableGames.has(game),
    );
  }, [tournaments]);

  useEffect(() => {
    const requestedGame = new URLSearchParams(window.location.search).get("game");

    if (requestedGame && games.includes(requestedGame)) {
      setActiveGame(requestedGame);
    }
  }, [games]);

  const visibleTournaments = useMemo(() => {
    if (activeGame === "All") return tournaments;

    return tournaments.filter((tournament) => tournament.game === activeGame);
  }, [activeGame, tournaments]);

  function selectGame(game) {
    setActiveGame(game);

    const url = new URL(window.location.href);

    if (game === "All") {
      url.searchParams.delete("game");
    } else {
      url.searchParams.set("game", game);
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <>
      <div className="directory-toolbar">
        <div className="tournament-filters" aria-label="Filter tournaments by game">
          {games.map((game) => (
            <button
              className={`filter-button${activeGame === game ? " is-active" : ""}`}
              type="button"
              aria-pressed={activeGame === game}
              onClick={() => selectGame(game)}
              key={game}
            >
              {game}
            </button>
          ))}
        </div>

        <p className="directory-count" aria-live="polite">
          {visibleTournaments.length} tournament{visibleTournaments.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="directory-grid">
        {visibleTournaments.map((tournament) => (
          <Link className="directory-card" id={tournament.id} href={`/tournaments/${tournament.slug}`} key={tournament.id} aria-label={`View ${tournament.name} tournament details`}>
            <div className="directory-card-media">
              <Image
                src={tournament.image}
                alt={`${tournament.game} tournament`}
                fill
                sizes="(max-width: 820px) 100vw, 33vw"
              />
              <span className="upcoming-date">{tournament.date}</span>
            </div>

            <div className="directory-card-body">
              <div className="directory-card-title">
                <div>
                  <p className="upcoming-game">{tournament.game}</p>
                  <h2>{tournament.name}</h2>
                </div>
                <span className={`tournament-status${tournament.status === "Registration open" ? " is-open" : ""}`}>
                  {tournament.status}
                </span>
              </div>

              <dl className="directory-details">
                <div>
                  <dt>Starts</dt>
                  <dd>{tournament.time}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{tournament.format}</dd>
                </div>
                <div>
                  <dt>Prize</dt>
                  <dd>{tournament.prize}</dd>
                </div>
              </dl>
            </div>
          </Link>
        ))}
      </div>
      {visibleTournaments.length === 0 && (
        <div className="invitation-empty">
          <p className="section-kicker">Tournament calendar</p>
          <h2>No tournaments published</h2>
          <p>New events will appear here after they are published by Khilafat Esports.</p>
        </div>
      )}
    </>
  );
}
