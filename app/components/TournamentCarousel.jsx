"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function TournamentCarousel({ tournaments }) {
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return;

    function updateControls() {
      const maximumScroll = Math.max(0, track.scrollWidth - track.clientWidth);

      setAtStart(track.scrollLeft <= 1);
      setAtEnd(track.scrollLeft >= maximumScroll - 1);
    }

    updateControls();
    track.addEventListener("scroll", updateControls, { passive: true });

    const resizeObserver = new ResizeObserver(updateControls);
    resizeObserver.observe(track);

    return () => {
      track.removeEventListener("scroll", updateControls);
      resizeObserver.disconnect();
    };
  }, []);

  function move(direction) {
    const track = trackRef.current;
    const firstCard = track?.querySelector(".tournament-card");

    if (!track || !firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = firstCard.getBoundingClientRect().width + gap;

    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  return (
    <div className="carousel-shell">
      <div className="tournament-track" ref={trackRef}>
        {tournaments.map((tournament, index) => (
          <a
            className="tournament-card"
            href={`/tournaments?game=${encodeURIComponent(tournament.name)}`}
            key={tournament.name}
            aria-label={`View upcoming ${tournament.name} tournaments`}
          >
            <Image
              src={tournament.image}
              alt={`${tournament.name} tournaments`}
              fill
              loading={index === 0 ? "eager" : "lazy"}
              sizes="(max-width: 700px) 72vw, 25vw"
            />
          </a>
        ))}
      </div>

      <button
        className={`carousel-button carousel-button-previous${atStart ? " is-hidden" : ""}`}
        type="button"
        onClick={() => move(-1)}
        aria-label="Previous tournament"
        disabled={atStart}
      >
        <span aria-hidden="true">‹</span>
      </button>

      <button
        className={`carousel-button carousel-button-next${atEnd ? " is-hidden" : ""}`}
        type="button"
        onClick={() => move(1)}
        aria-label="Next tournament"
        disabled={atEnd}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
