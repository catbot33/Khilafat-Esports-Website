"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { createClient } from "../lib/supabase/client";

function MatchControl({ match, participants, onUpdate, saving, drawsAllowed }) {
  const [scoreA, setScoreA] = useState(match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.scoreB ?? 0);
  const teamA = participants.get(match.teamA);
  const teamB = participants.get(match.teamB);
  const locked = match.status === "Completed" || match.status === "Bye";
  const ready = Boolean(teamA && teamB) && !locked;
  const isLive = match.status === "Live";
  const hasChanges = Number(scoreA) !== Number(match.scoreA ?? 0) || Number(scoreB) !== Number(match.scoreB ?? 0);
  const tied = Number(scoreA) === Number(scoreB);

  function setValidScore(setter, value) {
    const parsed = Number.parseInt(value, 10);
    setter(Number.isInteger(parsed) ? Math.max(0, parsed) : 0);
  }

  function stepScore(setter, current, amount) {
    setter(Math.max(0, Number(current) + amount));
  }

  function saveLiveScore() {
    if (ready && !saving) onUpdate(match.id, scoreA, scoreB, "Live");
  }

  useEffect(() => {
    setScoreA(match.scoreA ?? 0);
    setScoreB(match.scoreB ?? 0);
  }, [match.scoreA, match.scoreB]);

  return (
    <article className={`live-control-match is-${match.status.toLowerCase()}`}>
      <div className="live-control-match-topline">
        <span>Match {match.order}</span>
        <strong><i aria-hidden="true" />{match.status}</strong>
      </div>
      <div className="live-control-team-row">
        <span>{teamA?.name || "Awaiting team"}</span>
        <div className="live-score-stepper">
          <button type="button" aria-label={`Decrease ${teamA?.name || "team one"} score`} disabled={!ready || saving || Number(scoreA) === 0} onClick={() => stepScore(setScoreA, scoreA, -1)}>−</button>
          <input aria-label={`${teamA?.name || "Team one"} score`} type="number" min="0" inputMode="numeric" value={scoreA} disabled={!ready || saving} onChange={(event) => setValidScore(setScoreA, event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveLiveScore()} />
          <button type="button" aria-label={`Increase ${teamA?.name || "team one"} score`} disabled={!ready || saving} onClick={() => stepScore(setScoreA, scoreA, 1)}>+</button>
        </div>
      </div>
      <div className="live-control-team-row">
        <span>{teamB?.name || (match.status === "Bye" ? "Bye" : "Awaiting team")}</span>
        <div className="live-score-stepper">
          <button type="button" aria-label={`Decrease ${teamB?.name || "team two"} score`} disabled={!ready || saving || Number(scoreB) === 0} onClick={() => stepScore(setScoreB, scoreB, -1)}>−</button>
          <input aria-label={`${teamB?.name || "Team two"} score`} type="number" min="0" inputMode="numeric" value={scoreB} disabled={!ready || saving} onChange={(event) => setValidScore(setScoreB, event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveLiveScore()} />
          <button type="button" aria-label={`Increase ${teamB?.name || "team two"} score`} disabled={!ready || saving} onClick={() => stepScore(setScoreB, scoreB, 1)}>+</button>
        </div>
      </div>
      <div className="live-score-save-state" aria-live="polite">
        <span>{hasChanges ? "Unsaved score changes" : isLive ? "Score is live" : locked ? "Match locked" : "Ready to start"}</span>
        {isLive && !drawsAllowed && tied && <strong>Choose a winner to finish</strong>}
      </div>
      <div className="live-control-match-actions">
        <button className="is-primary" type="button" disabled={!ready || saving || (isLive && !hasChanges)} onClick={saveLiveScore}>{isLive ? "Update score" : "Start match"}</button>
        <button className="is-finish" type="button" title={!drawsAllowed && tied ? "Elimination matches need a winner." : "Finish this match"} disabled={!ready || saving || (!drawsAllowed && tied)} onClick={() => onUpdate(match.id, scoreA, scoreB, "Completed")}>Finish match</button>
      </div>
    </article>
  );
}

export default function LiveScoreControl({ tournaments, registrations, initialEvents, databaseReady }) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedTournamentId, setSelectedTournamentId] = useState(initialEvents.find((event) => event.status === "Live")?.tournamentId || tournaments[0]?.id || "");
  const [selectedEntryIds, setSelectedEntryIds] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [notice, setNotice] = useState(databaseReady ? "" : "Run the live tournament engine migration in Supabase to activate this workspace.");
  const [saving, setSaving] = useState(false);
  const socketRef = useRef(null);

  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId);
  const selectedEvent = events.find((event) => event.tournamentId === selectedTournamentId);
  const tournamentEntries = useMemo(() => registrations.filter((entry) => entry.tournamentId === selectedTournamentId), [registrations, selectedTournamentId]);
  const participants = useMemo(() => new Map((selectedEvent?.participants || []).map((participant) => [participant.id, participant])), [selectedEvent]);
  const rounds = useMemo(() => {
    const grouped = new Map();
    for (const match of selectedEvent?.matches || []) {
      const key = `${match.stage}|${match.round}`;
      if (!grouped.has(key)) grouped.set(key, { stage: match.stage, round: match.round, matches: [] });
      grouped.get(key).matches.push(match);
    }
    return [...grouped.values()].sort((a, b) => a.round - b.round || a.stage.localeCompare(b.stage));
  }, [selectedEvent]);

  useEffect(() => {
    const currentEvent = events.find((event) => event.tournamentId === selectedTournamentId);
    setSelectedEntryIds(currentEvent?.participants.map((participant) => participant.registrationId || participant.id) || []);
    setYoutubeUrl(currentEvent?.youtubeUrl || "");
    setDiscordUrl(currentEvent?.discordUrl || "");
  }, [events, selectedTournamentId]);

  useEffect(() => {
    let active = true;
    async function connect() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      socketRef.current = io(process.env.NEXT_PUBLIC_MAIN_SITE_URL || "http://localhost:3000", {
        path: "/socket.io",
        auth: { accessToken: session?.access_token || "" },
      });
    }
    connect();
    return () => {
      active = false;
      socketRef.current?.disconnect();
    };
  }, []);

  function publishLiveEvent(liveEvent) {
    socketRef.current?.emit("live:publish", { event: liveEvent });
  }

  function storeEvent(liveEvent) {
    setEvents((current) => {
      const others = current
        .filter((event) => event.id !== liveEvent.id)
        .map((event) => liveEvent.status === "Live" && event.status === "Live" ? { ...event, status: "Setup", activeMatchId: null } : event);
      return [liveEvent, ...others];
    });
    publishLiveEvent(liveEvent.status === "Live" ? liveEvent : null);
  }

  async function runAction(payload) {
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/live-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setNotice(result?.error || "Live tournament could not be updated.");
      return null;
    }
    return result;
  }

  async function generateBracket(event) {
    event.preventDefault();
    if (selectedEvent && !window.confirm("Regenerate this bracket? Existing scores and progression will be replaced.")) return;
    const result = await runAction({ action: "create", tournamentId: selectedTournamentId, registrationIds: selectedEntryIds, youtubeUrl, discordUrl });
    if (!result?.liveEvent) return;
    storeEvent(result.liveEvent);
    setNotice("Bracket generated. Review it, then launch the tournament live.");
  }

  async function launchEvent() {
    const result = await runAction({ action: "launch", eventId: selectedEvent.id });
    if (!result?.liveEvent) return;
    storeEvent(result.liveEvent);
    setNotice("Tournament is now live on the public website.");
  }

  async function updateMatch(matchId, scoreA, scoreB, matchStatus) {
    const result = await runAction({ action: "score", eventId: selectedEvent.id, matchId, scoreA, scoreB, matchStatus });
    if (!result?.liveEvent) return;
    storeEvent(result.liveEvent);
    setNotice(matchStatus === "Completed" ? "Result saved and the next round was updated automatically." : "This match is now live.");
  }

  async function removeEvent() {
    if (!window.confirm("Remove this generated live bracket? Tournament entries will not be deleted.")) return;
    const result = await runAction({ action: "remove", eventId: selectedEvent.id });
    if (!result?.removed) return;
    setEvents((current) => current.filter((event) => event.id !== result.eventId));
    publishLiveEvent(null);
    setNotice("Live bracket removed.");
  }

  function toggleEntry(id) {
    setSelectedEntryIds((current) => current.includes(id) ? current.filter((entryId) => entryId !== id) : [...current, id]);
  }

  return (
    <section className="live-control-workspace">
      <div className="live-control-setup">
        <div className="live-control-section-heading">
          <div><span>01</span><h2>Tournament setup</h2></div>
          {selectedEvent && <strong className={`live-control-state is-${selectedEvent.status.toLowerCase()}`}>{selectedEvent.status}</strong>}
        </div>

        <form onSubmit={generateBracket}>
          <label className="live-control-field">
            <span>Tournament</span>
            <select value={selectedTournamentId} onChange={(event) => setSelectedTournamentId(event.target.value)} required>
              {tournaments.map((tournament) => <option value={tournament.id} key={tournament.id}>{tournament.name} · {tournament.game}</option>)}
            </select>
          </label>

          <div className="live-format-lock">
            <span>Bracket format</span>
            <strong>{selectedTournament?.format || "Select a tournament"}</strong>
            <small>Inherited from the published tournament</small>
          </div>

          <div className="live-entry-picker">
            <div><span>Competing entries</span><strong>{selectedEntryIds.length} selected</strong></div>
            <div className="live-entry-options">
              {tournamentEntries.map((entry, index) => (
                <label className={selectedEntryIds.includes(entry.id) ? "is-selected" : ""} key={entry.id}>
                  <input type="checkbox" checked={selectedEntryIds.includes(entry.id)} onChange={() => toggleEntry(entry.id)} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p><strong>{entry.teamName}</strong><small>{entry.status} · {entry.riotId}</small></p>
                </label>
              ))}
              {tournamentEntries.length === 0 && <p className="live-control-empty">This tournament has no entries yet.</p>}
            </div>
          </div>

          <div className="live-link-fields">
            <label className="live-control-field"><span>YouTube live URL</span><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtube.com/live/..." /></label>
            <label className="live-control-field"><span>Discord URL</span><input type="url" value={discordUrl} onChange={(event) => setDiscordUrl(event.target.value)} placeholder="https://discord.gg/..." /></label>
          </div>

          <button className="generate-bracket-button" type="submit" disabled={saving || selectedEntryIds.length < 2 || !databaseReady}>{selectedEvent ? "Regenerate bracket" : "Generate bracket"}<span aria-hidden="true">→</span></button>
        </form>
      </div>

      {selectedEvent && (
        <div className="live-control-bracket">
          <div className="live-control-section-heading">
            <div><span>02</span><h2>Match control</h2></div>
            <div className="live-bracket-actions">
              {selectedEvent.status === "Setup" && <button type="button" onClick={launchEvent} disabled={saving}>Launch live</button>}
              <button className="is-danger" type="button" onClick={removeEvent} disabled={saving}>Remove</button>
            </div>
          </div>

          <div className="live-control-summary">
            <div><span>Tournament</span><strong>{selectedEvent.tournament?.name}</strong></div>
            <div><span>Format</span><strong>{selectedEvent.format}</strong></div>
            <div><span>Current round</span><strong>{selectedEvent.currentRound}{selectedEvent.totalRounds ? ` / ${selectedEvent.totalRounds}` : ""}</strong></div>
            <div><span>Teams</span><strong>{selectedEvent.participants.length}</strong></div>
          </div>

          <div className="live-control-rounds">
            {rounds.map((round) => (
              <section key={`${round.stage}-${round.round}`}>
                <header><span>{round.stage}</span><strong>Round {round.round}</strong></header>
                <div>
                  {round.matches.map((match) => <MatchControl match={match} participants={participants} onUpdate={updateMatch} saving={saving} drawsAllowed={selectedEvent.format === "Swiss" || selectedEvent.format === "Round Robin"} key={match.id} />)}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {notice && <p className="live-control-notice" role="status">{notice}</p>}
    </section>
  );
}
