"use client";

import { useState } from "react";
import { valorantRankGroups } from "../data/valorantRanks";

function newPlayer() {
  return { discordName: "", riotId: "", currentRank: "Unranked" };
}

function playerIsComplete(player) {
  return Boolean(player.discordName.trim() && player.riotId.includes("#") && player.currentRank);
}

export default function ValorantRegistrationForm({ tournament, registrationOpen, isAuthenticated, existingRegistration }) {
  const teamSize = [1, 2, 5].includes(Number(tournament.teamSize)) ? Number(tournament.teamSize) : 5;
  const [captain, setCaptain] = useState({ teamName: "", ...newPlayer() });
  const [teammates, setTeammates] = useState(() => Array.from({ length: teamSize - 1 }, newPlayer));
  const [state, setState] = useState({
    status: existingRegistration ? "submitted" : "idle",
    message: "",
  });

  function updateCaptain(field, value) {
    setCaptain((current) => ({ ...current, [field]: value }));
  }

  function updateTeammate(index, field, value) {
    setTeammates((current) => current.map((teammate, teammateIndex) => (
      teammateIndex === index ? { ...teammate, [field]: value } : teammate
    )));
  }

  async function submitRegistration(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState({ status: "loading", message: "" });

    const formData = new FormData(formElement);
    const payload = {
      tournamentSlug: tournament.slug,
      teamName: captain.teamName,
      discordName: captain.discordName,
      riotId: captain.riotId,
      currentRank: captain.currentRank,
      teammates,
      website: formData.get("website"),
    };

    try {
      const response = await fetch("/api/tournament-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        if (result.alreadySubmitted) {
          setState({ status: "submitted", message: "" });
          return;
        }
        setState({ status: "error", message: result.error ?? "Registration could not be submitted." });
        return;
      }

      setState({ status: "submitted", message: "" });
    } catch {
      setState({ status: "error", message: "Registration could not be submitted. Please try again." });
    }
  }

  const databaseConnected = Boolean(tournament.databaseId);
  const captainComplete = playerIsComplete(captain);
  const completedPlayers = (captainComplete ? 1 : 0) + teammates.filter(playerIsComplete).length;
  const rosterComplete = Boolean(captain.teamName.trim())
    && captainComplete
    && teammates.length === teamSize - 1
    && teammates.every(playerIsComplete);
  const canEdit = registrationOpen;
  const canSubmit = registrationOpen && databaseConnected && rosterComplete;

  if (!isAuthenticated) {
    return (
      <div className="registration-account-required">
        <span aria-hidden="true">K</span>
        <h3>Sign in to register</h3>
        <p>Your account keeps your tournament entries secure and prevents duplicate submissions.</p>
        <a href={`/signup?mode=login&next=/tournaments/${encodeURIComponent(tournament.slug)}`}>Sign in <span aria-hidden="true">→</span></a>
      </div>
    );
  }

  if (state.status === "submitted") {
    return (
      <div className="registration-submitted" role="status">
        <span className="registration-submitted-mark" aria-hidden="true">✓</span>
        <p className="section-kicker">Entry received</p>
        <h3>You have already submitted this form</h3>
        <p>Your entry is saved for this tournament. Khilafat Esports will contact you on Discord after reviewing it.</p>
        <a href="/tournaments">View other tournaments <span aria-hidden="true">→</span></a>
      </div>
    );
  }

  return (
    <form className="valorant-registration-form" onSubmit={submitRegistration}>
      <input className="registration-honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />

      <div className="roster-format-summary">
        <span>{teamSize}v{teamSize}</span>
        <div>
          <strong>{teamSize === 1 ? "Individual entry" : "Complete team required"}</strong>
          <p>{teamSize === 1 ? "Enter your own player information." : `The captain and all ${teamSize - 1} teammate ${teamSize - 1 === 1 ? "slot" : "slots"} must be completed together.`}</p>
        </div>
      </div>

      <div className="registration-player-heading">
        <strong>{teamSize === 1 ? "Player details" : "Player 1 · Team captain"}</strong>
        <span>{captainComplete ? "Complete" : "Required"}</span>
      </div>

      <div className="registration-fields">
        <label>
          <span>{teamSize === 1 ? "Entry name" : "Team name"}</span>
          <input value={captain.teamName} onChange={(event) => updateCaptain("teamName", event.target.value)} placeholder={teamSize === 1 ? "Player entry" : "Team Khilafat"} maxLength={64} required disabled={!canEdit} />
        </label>
        <label>
          <span>Discord name</span>
          <input value={captain.discordName} onChange={(event) => updateCaptain("discordName", event.target.value)} placeholder="username" maxLength={64} required disabled={!canEdit} />
        </label>
        <label>
          <span>Riot username with tag</span>
          <input value={captain.riotId} onChange={(event) => updateCaptain("riotId", event.target.value)} placeholder="PlayerName#TAG" maxLength={40} required disabled={!canEdit} />
        </label>
        <label>
          <span>Current rank</span>
          <select value={captain.currentRank} onChange={(event) => updateCaptain("currentRank", event.target.value)} required disabled={!canEdit}>
            {valorantRankGroups.map((group) => (
              <optgroup label={group.tier} key={group.tier}>
                {group.divisions.map((rank) => <option key={rank}>{rank}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {teamSize > 1 && (
        <fieldset className="roster-fields" disabled={!canEdit}>
          <legend>Remaining team roster</legend>
          <div className="stack-members">
            {teammates.map((teammate, index) => (
              <div className="stack-member" key={index}>
                <div className="stack-member-heading">
                  <strong>Player {index + 2}</strong>
                  <span>{playerIsComplete(teammate) ? "Complete" : "Required"}</span>
                </div>
                <div className="stack-member-fields">
                  <label><span>Discord name</span><input value={teammate.discordName} onChange={(event) => updateTeammate(index, "discordName", event.target.value)} placeholder="username" maxLength={64} required /></label>
                  <label><span>Riot username with tag</span><input value={teammate.riotId} onChange={(event) => updateTeammate(index, "riotId", event.target.value)} placeholder="PlayerName#TAG" maxLength={40} required /></label>
                  <label><span>Current rank</span><select value={teammate.currentRank} onChange={(event) => updateTeammate(index, "currentRank", event.target.value)}>{valorantRankGroups.map((group) => <optgroup label={group.tier} key={group.tier}>{group.divisions.map((rank) => <option key={rank}>{rank}</option>)}</optgroup>)}</select></label>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <div className={`roster-completion${rosterComplete ? " is-complete" : ""}`}>
        <div>
          <strong>{completedPlayers} / {teamSize} players complete</strong>
          <span>{rosterComplete ? "Roster ready" : "Complete every player slot to submit"}</span>
        </div>
        {teamSize > 1 && completedPlayers === teamSize - 1 && <a href="/looking-for-player?game=Valorant">Find the final player <span aria-hidden="true">→</span></a>}
      </div>

      {!registrationOpen && <p className="registration-availability">Registration has not opened for this tournament.</p>}
      {registrationOpen && !databaseConnected && <p className="registration-availability">Connect the public website to Supabase to accept submissions.</p>}
      {state.message && <p className={`registration-message is-${state.status}`} role="status">{state.message}</p>}

      <button className="registration-submit" type="submit" disabled={!canSubmit || state.status === "loading"}>
        {state.status === "loading" ? "Submitting…" : rosterComplete ? "Submit complete roster" : `Complete all ${teamSize} players`}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
