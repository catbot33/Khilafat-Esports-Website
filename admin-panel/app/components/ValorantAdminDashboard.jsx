"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { mapTournamentRow } from "../lib/tournaments";
import LiveScoreControl from "./LiveScoreControl";

const tournamentTypes = [
  { name: "Valorant", available: true },
  { name: "CS2", available: false },
  { name: "Chess", available: false },
  { name: "Roblox", available: false },
];

const tournamentFormats = ["Single Elimination", "Double Elimination", "Swiss", "Round Robin"];
const valorantServerGroups = [
  { region: "Pakistan — nearby servers", servers: ["Riyadh", "Mumbai"] },
  {
    region: "North America",
    servers: ["US West (Oregon)", "US West (N. California)", "US East (N. Virginia)", "US Central (Texas)", "US Central (Illinois)", "US Central (Georgia)"],
  },
  { region: "Latin America", servers: ["Santiago", "Mexico City", "Miami"] },
  { region: "Brazil", servers: ["São Paulo"] },
  {
    region: "Europe / MENA / Africa",
    servers: ["Frankfurt", "Paris", "Stockholm", "Istanbul", "London", "Warsaw", "Madrid", "Bahrain", "Cape Town"],
  },
  { region: "Korea", servers: ["Seoul"] },
  { region: "Asia Pacific", servers: ["Hong Kong", "Tokyo", "Singapore", "Sydney", "Manila"] },
];
const valorantVariants = [
  "Competitive",
  "Unrated",
  "Swiftplay",
  "Premier",
  "Spike Rush",
  "Team Deathmatch",
  "Skirmish",
  "Gauntlet: Glitched",
];
const valorantTeamSizes = [
  { value: "5", label: "5v5" },
  { value: "2", label: "2v2" },
  { value: "1", label: "1v1" },
];
const standardValorantMaps = ["Summit", "Corrode", "Abyss", "Sunset", "Lotus", "Pearl", "Fracture", "Breeze", "Icebox", "Ascent", "Split", "Haven", "Bind"];
const teamDeathmatchMaps = ["Piazza", "District", "Kasbah", "Drift", "Glitch"];
const skirmishMaps = ["Site A", "Site B", "Site C", "Site D", "Site E"];

function mapsForVariant(variant) {
  if (variant === "Team Deathmatch") return teamDeathmatchMaps;
  if (variant === "Skirmish") return skirmishMaps;
  if (variant === "Gauntlet: Glitched") return [];
  return standardValorantMaps;
}
const blankTournament = {
  name: "",
  description: "",
  format: "Single Elimination",
  variant: "Competitive",
  teamSize: "5",
  mapName: "Summit",
  prize: "",
  date: "",
  time: "",
  regionServer: "Pakistan — nearby servers / Riyadh",
};

function formatDate(value) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  if (!value) return "Time not set";
  const [hour, minute] = value.split(":");
  return `${new Date(2026, 0, 1, Number(hour), Number(minute)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} PKT`;
}

function formatSubmittedAt(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function tournamentErrorMessage(error) {
  if (error?.code === "42501" || /row-level security/i.test(error?.message ?? "")) {
    return "Your admin session is no longer authorized. Sign out, then sign in to the admin panel again.";
  }

  const missingTournamentField = error?.code === "PGRST204"
    || /schema cache|description|region_server|tournament_variant|team_size|map_name/i.test(error?.message ?? "");

  if (missingTournamentField) {
    return "Database update required. Run the latest tournament registration migration in Supabase, then publish again.";
  }

  return `Tournament could not be published: ${error?.message ?? "Unknown database error"}`;
}

export default function ValorantAdminDashboard({ initialTournaments, initialRegistrations, initialLiveEvents, liveDatabaseReady, user, initialError }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [activeSection, setActiveSection] = useState("Overview");
  const [creating, setCreating] = useState(false);
  const [selectedGame, setSelectedGame] = useState("");
  const [form, setForm] = useState(blankTournament);
  const [notice, setNotice] = useState(initialError);
  const [saving, setSaving] = useState(false);
  const [entrySearch, setEntrySearch] = useState("");
  const [entryGame, setEntryGame] = useState("All");
  const [entryTournament, setEntryTournament] = useState("All");

  const publishedTournaments = useMemo(() => tournaments.filter((tournament) => tournament.visibility === "Published"), [tournaments]);
  const visibleTournaments = activeSection === "Published" ? publishedTournaments : tournaments;
  const stats = useMemo(() => {
    const open = tournaments.filter((tournament) => tournament.status === "Registration open").length;
    const nextTournament = [...publishedTournaments].filter((tournament) => tournament.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    return { published: publishedTournaments.length, open, nextTournament };
  }, [publishedTournaments, tournaments]);
  const viewingEntries = activeSection === "Entries" && !creating;
  const viewingLiveScores = activeSection === "Live scores" && !creating;
  const entryStats = useMemo(() => ({
    total: initialRegistrations.length,
    solo: initialRegistrations.filter((entry) => entry.entryType === "Solo").length,
    stacks: initialRegistrations.filter((entry) => entry.entryType === "Stack").length,
  }), [initialRegistrations]);
  const entryGames = useMemo(() => ["All", ...new Set(initialRegistrations.map((entry) => entry.tournament?.game).filter(Boolean))], [initialRegistrations]);
  const entryTournaments = useMemo(() => {
    const relevantEntries = entryGame === "All"
      ? initialRegistrations
      : initialRegistrations.filter((entry) => entry.tournament?.game === entryGame);
    const unique = new Map(relevantEntries.map((entry) => [entry.tournamentId, entry.tournament?.name]));
    return [...unique].filter(([, name]) => name);
  }, [entryGame, initialRegistrations]);
  const filteredEntries = useMemo(() => {
    const query = entrySearch.trim().toLowerCase();
    return initialRegistrations.filter((entry) => {
      const matchesGame = entryGame === "All" || entry.tournament?.game === entryGame;
      const matchesTournament = entryTournament === "All" || entry.tournamentId === entryTournament;
      const searchable = [
        entry.teamName,
        entry.discordName,
        entry.riotId,
        ...entry.teammates.flatMap((teammate) => [teammate?.discordName, teammate?.riotId]),
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesGame && matchesTournament && (!query || searchable.includes(query));
    });
  }, [entryGame, entrySearch, entryTournament, initialRegistrations]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => {
      if (name !== "variant") return { ...current, [name]: value };

      const availableMaps = mapsForVariant(value);
      return {
        ...current,
        variant: value,
        mapName: availableMaps[0] || "",
      };
    });
  }

  function openSection(section) {
    if (section === "Listed players") return;
    setActiveSection(section);
    setCreating(false);
    setSelectedGame("");
  }

  function startTournament() {
    setCreating(true);
    setSelectedGame("");
    setForm(blankTournament);
  }

  async function createTournament(event) {
    event.preventDefault();
    setSaving(true);
    const baseSlug = slugify(form.name) || `valorant-${Date.now()}`;
    const initialSlug = tournaments.some((tournament) => slugify(tournament.name) === baseSlug) ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    const tournamentValues = {
      name: form.name,
      description: form.description,
      game: "Valorant",
      start_at: new Date(`${form.date}T${form.time}:00+05:00`).toISOString(),
      format: form.format,
      tournament_variant: form.variant,
      team_size: Number(form.teamSize),
      map_name: form.variant === "Gauntlet: Glitched" ? "" : form.mapName,
      status: "Registration open",
      prize: form.prize,
      region_server: form.regionServer,
      image_url: "/images/valorant-tournament-v2.png",
      visibility: "Published",
      featured: false,
      created_by: user.id,
    };

    async function insertTournament(slug) {
      return supabase
        .from("tournaments")
        .insert({ ...tournamentValues, slug })
        .select("id, name, description, game, start_at, format, tournament_variant, team_size, map_name, status, prize, region_server, image_url, visibility, featured")
        .single();
    }

    let { data, error } = await insertTournament(initialSlug);

    if (error?.code === "23505" && /tournaments_slug_key|slug/i.test(`${error.message ?? ""} ${error.details ?? ""}`)) {
      ({ data, error } = await insertTournament(`${baseSlug}-${Date.now().toString(36)}`));
    }

    if (error) {
      setNotice(tournamentErrorMessage(error));
      setSaving(false);
      return;
    }

    setTournaments((current) => [mapTournamentRow(data), ...current]);
    setForm(blankTournament);
    setSelectedGame("");
    setCreating(false);
    setActiveSection("Published");
    setNotice(`${form.name} was published.`);
    window.setTimeout(() => setNotice(""), 3600);
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="admin-shell minimal-admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span className="brand-emblem">K</span><div><strong>Khilafat</strong><span>Control</span></div></div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {["Overview", "Published", "Entries", "Live scores", "Listed players"].map((section) => {
            const disabled = section === "Listed players";
            return (
              <button className={`${activeSection === section && !creating ? "is-active" : ""}${disabled ? " is-disabled" : ""}`} type="button" disabled={disabled} onClick={() => openSection(section)} key={section}>
                {section}{disabled && <small>Soon</small>}
              </button>
            );
          })}
        </nav>
        <div className="connection-card is-connected"><span className="connection-dot" aria-hidden="true" /><div><strong>Supabase connected</strong><span>Live database</span></div></div>
        <div className="admin-profile"><span>KA</span><div><strong>Khilafat Admin</strong><small>{user.email}</small></div><button type="button" onClick={signOut} aria-label="Sign out" title="Sign out">↪</button></div>
      </aside>

      <main className="admin-main minimal-admin-main">
        <header className="admin-header minimal-admin-header">
          <h1>{creating ? "New Tournament" : activeSection}</h1>
          <button className="new-tournament-link" type="button" onClick={startTournament}><span aria-hidden="true">+</span> New tournament</button>
        </header>

        {!viewingLiveScores && (viewingEntries ? (
          <section className="stats-grid minimal-stats" aria-label="Entry overview">
            <article className="stat-card"><span>Total entries</span><strong>{entryStats.total}</strong></article>
            <article className="stat-card"><span>Solo players</span><strong>{entryStats.solo}</strong></article>
            <article className="stat-card next-event-card"><span>Stacks</span><strong>{entryStats.stacks}</strong><small>{initialRegistrations.filter((entry) => entry.needsTeammate).length} looking for teammates</small></article>
          </section>
        ) : (
          <section className="stats-grid minimal-stats" aria-label="Tournament overview">
            <article className="stat-card"><span>Published</span><strong>{stats.published}</strong></article>
            <article className="stat-card"><span>Registration open</span><strong>{stats.open}</strong></article>
            <article className="stat-card next-event-card"><span>Next event</span><strong>{stats.nextTournament ? formatDate(stats.nextTournament.date) : "None"}</strong><small>{stats.nextTournament?.name ?? "No event scheduled"}</small></article>
          </section>
        ))}

        {creating ? (
          <section className="tournament-builder" aria-label="Create tournament">
            <div className="game-choice" aria-label="Choose tournament game">
              {tournamentTypes.map((game) => (
                <button className={selectedGame === game.name ? "is-active" : ""} type="button" disabled={!game.available} onClick={() => setSelectedGame(game.name)} key={game.name}>
                  {game.name}{!game.available && <small>Soon</small>}
                </button>
              ))}
            </div>
            {!selectedGame && <div className="game-choice-empty"><strong>Choose the tournament game</strong></div>}
            {selectedGame === "Valorant" && (
              <form className="valorant-form" onSubmit={createTournament}>
                <label><span>Tournament name</span><input name="name" value={form.name} onChange={updateField} placeholder="Sultan Series" maxLength={64} required /></label>
                <label className="field-full"><span>Description</span><textarea name="description" value={form.description} onChange={updateField} placeholder="Tournament details for players" rows={5} maxLength={600} required /></label>
                <label><span>Tournament format</span><select name="format" value={form.format} onChange={updateField}>{tournamentFormats.map((format) => <option key={format}>{format}</option>)}</select></label>
                <label><span>Valorant mode</span><select name="variant" value={form.variant} onChange={updateField}>{valorantVariants.map((variant) => <option key={variant}>{variant}</option>)}</select></label>
                <label><span>Team size</span><select name="teamSize" value={form.teamSize} onChange={updateField}>{valorantTeamSizes.map((size) => <option value={size.value} key={size.value}>{size.label}</option>)}</select></label>
                {form.variant !== "Gauntlet: Glitched" && (
                  <label><span>Map</span><select name="mapName" value={form.mapName} onChange={updateField}>{mapsForVariant(form.variant).map((map) => <option key={map}>{map}</option>)}</select></label>
                )}
                <label><span>Tournament prize pool</span><input name="prize" value={form.prize} onChange={updateField} placeholder="PKR 50,000" maxLength={56} required /></label>
                <label><span>Tournament date</span><input name="date" type="date" value={form.date} onChange={updateField} required /></label>
                <label><span>Tournament time</span><input name="time" type="time" value={form.time} onChange={updateField} required /></label>
                <label className="field-full"><span>Region / server</span><select name="regionServer" value={form.regionServer} onChange={updateField}>{valorantServerGroups.map((group) => <optgroup label={group.region} key={group.region}>{group.servers.map((server) => <option value={`${group.region} / ${server}`} key={server}>{server}</option>)}</optgroup>)}</select></label>
                <div className="valorant-form-actions field-full"><button type="button" onClick={() => setSelectedGame("")}>Back</button><button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish tournament"}<span aria-hidden="true">→</span></button></div>
              </form>
            )}
          </section>
        ) : viewingLiveScores ? (
          <LiveScoreControl
            tournaments={tournaments}
            registrations={initialRegistrations}
            initialEvents={initialLiveEvents}
            databaseReady={liveDatabaseReady}
          />
        ) : viewingEntries ? (
          <section className="entries-panel" aria-label="Tournament entries">
            <div className="entries-toolbar">
              <label className="entries-search">
                <span className="sr-only">Search entries</span>
                <input value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} placeholder="Search team, Discord or Riot ID" />
              </label>
              <label>
                <span>Game</span>
                <select value={entryGame} onChange={(event) => { setEntryGame(event.target.value); setEntryTournament("All"); }}>
                  {entryGames.map((game) => <option key={game}>{game}</option>)}
                </select>
              </label>
              <label>
                <span>Tournament</span>
                <select value={entryTournament} onChange={(event) => setEntryTournament(event.target.value)}>
                  <option value="All">All tournaments</option>
                  {entryTournaments.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
                </select>
              </label>
              <p>{filteredEntries.length} of {initialRegistrations.length} entries</p>
            </div>

            <div className="entries-list">
              <div className="entries-list-head"><span>Team / player</span><span>Tournament</span><span>Entry</span><span>Rank</span><span>Status</span><span /></div>
              {filteredEntries.map((entry) => (
                <details className="entry-card" key={entry.id}>
                  <summary>
                    <div className="entry-identity">
                      <span className={`game-mark game-${(entry.tournament?.game ?? "game").toLowerCase()}`}>{(entry.tournament?.game ?? "G").slice(0, 2)}</span>
                      <p><strong>{entry.teamName}</strong><small>{entry.riotId} · {entry.discordName}</small></p>
                    </div>
                    <p><strong>{entry.tournament?.name ?? "Unknown tournament"}</strong><small>{entry.tournament?.game ?? "Unknown game"}</small></p>
                    <span className="entry-type">{entry.entryType}</span>
                    <span>{entry.currentRank}</span>
                    <span className={`entry-status is-${entry.status.toLowerCase()}`}>{entry.status}</span>
                    <span className="entry-expand" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="entry-detail-body">
                    <dl className="entry-primary-details">
                      <div><dt>Team name</dt><dd>{entry.teamName}</dd></div>
                      <div><dt>Riot ID</dt><dd>{entry.riotId}</dd></div>
                      <div><dt>Discord</dt><dd>{entry.discordName}</dd></div>
                      <div><dt>Current rank</dt><dd>{entry.currentRank}</dd></div>
                      <div><dt>Entry type</dt><dd>{entry.entryType}</dd></div>
                      <div><dt>Submitted</dt><dd>{formatSubmittedAt(entry.createdAt)}</dd></div>
                    </dl>
                    {entry.entryType === "Solo" ? (
                      <div className={`entry-teammate-state${entry.needsTeammate ? " needs-player" : ""}`}>
                        <strong>{entry.needsTeammate ? "Needs a teammate" : "Entering solo"}</strong>
                        <span>{entry.needsTeammate ? "Visible for team matching" : "No teammate request"}</span>
                      </div>
                    ) : (
                      <div className="entry-stack">
                        <p>Stack members</p>
                        <div>
                          {entry.teammates.map((teammate, index) => (
                            <article key={`${entry.id}-${index}`}><span>{index + 1}</span><p><strong>{teammate.riotId}</strong><small>{teammate.discordName}</small></p><em>{teammate.currentRank}</em></article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
              {filteredEntries.length === 0 && <div className="minimal-empty">No entries match these filters.</div>}
            </div>
          </section>
        ) : (
          <section className="minimal-tournament-list" aria-label={`${activeSection} tournaments`}>
            <div className="minimal-list-head"><span>Tournament</span><span>Date and time</span><span>Format</span><span>Status</span></div>
            {visibleTournaments.map((tournament) => (
              <article className="minimal-list-row" key={tournament.id}>
                <div><span className={`game-mark game-${tournament.game.toLowerCase()}`}>{tournament.game.slice(0, 2)}</span><p><strong>{tournament.name}</strong><small>{tournament.game}</small></p></div>
                <p><strong>{formatDate(tournament.date)}</strong><small>{formatTime(tournament.time)}</small></p>
                <span>{tournament.teamSize}v{tournament.teamSize} · {tournament.format}</span><span className={tournament.status === "Registration open" ? "is-open" : ""}>{tournament.status}</span>
              </article>
            ))}
            {visibleTournaments.length === 0 && <div className="minimal-empty">No tournaments here yet.</div>}
          </section>
        )}
      </main>
      {notice && <div className={`admin-notice${notice.includes("required") || notice.includes("could not") ? " is-error" : ""}`} role="status"><span aria-hidden="true">{notice.includes("required") || notice.includes("could not") ? "!" : "✓"}</span>{notice}</div>}
    </div>
  );
}
