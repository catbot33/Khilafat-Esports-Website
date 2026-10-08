"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { mapTournamentRow } from "../lib/tournaments";

const games = ["Valorant", "CS2", "Chess", "Roblox"];
const statuses = ["Registration open", "Coming soon", "Registration closed"];
const blankTournament = {
  name: "",
  game: "Valorant",
  date: "",
  time: "",
  format: "",
  status: "Registration open",
  prize: "",
  image: "",
  visibility: "Published",
  featured: false,
};

function formatDate(value) {
  if (!value) return "Date not set";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  if (!value) return "Time not set";
  const [hour, minute] = value.split(":");
  const date = new Date(2026, 0, 1, Number(hour), Number(minute));

  return `${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} PKT`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminDashboard({ initialTournaments, user, initialError }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [form, setForm] = useState(blankTournament);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState(initialError);
  const [saving, setSaving] = useState(false);

  const visibleTournaments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tournaments.filter((tournament) => {
      const matchesFilter = filter === "All" || tournament.visibility === filter;
      const matchesSearch = [tournament.name, tournament.game, tournament.status]
        .join(" ")
        .toLowerCase()
        .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tournaments]);

  const stats = useMemo(() => {
    const published = tournaments.filter((tournament) => tournament.visibility === "Published").length;
    const open = tournaments.filter((tournament) => tournament.status === "Registration open").length;
    const drafts = tournaments.filter((tournament) => tournament.visibility === "Draft").length;
    const nextTournament = [...tournaments]
      .filter((tournament) => tournament.visibility === "Published" && tournament.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    return { published, open, drafts, nextTournament };
  }, [tournaments]);

  function updateField(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function createTournament(event) {
    event.preventDefault();
    setSaving(true);
    const baseId = slugify(form.name) || `tournament-${Date.now()}`;
    const slug = tournaments.some((tournament) => slugify(tournament.name) === baseId)
      ? `${baseId}-${Date.now()}`
      : baseId;

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        slug,
        name: form.name,
        game: form.game,
        start_at: new Date(`${form.date}T${form.time}:00+05:00`).toISOString(),
        format: form.format,
        status: form.status,
        prize: form.prize,
        image_url: form.image,
        visibility: form.visibility,
        featured: form.featured,
        created_by: user.id,
      })
      .select("id, name, game, start_at, format, status, prize, image_url, visibility, featured")
      .single();

    if (error) {
      setNotice(`Tournament could not be saved: ${error.message}`);
      setSaving(false);
      return;
    }

    setTournaments((current) => [mapTournamentRow(data), ...current]);
    setForm(blankTournament);
    setNotice(`${form.name} was ${form.visibility === "Published" ? "published" : "saved as a draft"}.`);
    window.setTimeout(() => setNotice(""), 3600);
    setSaving(false);
  }

  async function toggleVisibility(id) {
    const tournament = tournaments.find((entry) => entry.id === id);
    if (!tournament) return;

    const visibility = tournament.visibility === "Published" ? "Draft" : "Published";
    const { error } = await supabase
      .from("tournaments")
      .update({ visibility })
      .eq("id", id);

    if (error) {
      setNotice(`Visibility could not be changed: ${error.message}`);
      return;
    }

    setTournaments((current) => current.map((entry) => (
      entry.id === id ? { ...entry, visibility } : entry
    )));
    setNotice(`${tournament.name} is now ${visibility.toLowerCase()}.`);
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-emblem">K</span>
          <div>
            <strong>Khilafat</strong>
            <span>Control</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          <a href="#overview"><span aria-hidden="true">◫</span> Overview</a>
          <a className="is-active" href="#tournaments"><span aria-hidden="true">◇</span> Tournaments</a>
          <span className="disabled-link"><span aria-hidden="true">◉</span> Live scores <small>Soon</small></span>
          <span className="disabled-link"><span aria-hidden="true">◎</span> Player invites <small>Soon</small></span>
        </nav>

        <div className="connection-card is-connected">
          <span className="connection-dot" aria-hidden="true" />
          <div>
            <strong>Supabase connected</strong>
            <span>Live database</span>
          </div>
        </div>

        <div className="admin-profile">
          <span>KA</span>
          <div>
            <strong>Khilafat Admin</strong>
            <small>{user.email}</small>
          </div>
          <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out">↪</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-kicker">Tournament management</p>
            <h1>Khilafat Control</h1>
          </div>
          <a className="new-tournament-link" href="#create-tournament">
            <span aria-hidden="true">+</span> New tournament
          </a>
        </header>

        <section className="stats-grid" id="overview" aria-label="Tournament overview">
          <article className="stat-card">
            <span>Published</span>
            <strong>{stats.published}</strong>
            <small>Visible on the public website</small>
          </article>
          <article className="stat-card">
            <span>Registration open</span>
            <strong>{stats.open}</strong>
            <small>Accepting new teams or players</small>
          </article>
          <article className="stat-card">
            <span>Drafts</span>
            <strong>{stats.drafts}</strong>
            <small>Not visible to the public</small>
          </article>
          <article className="stat-card next-event-card">
            <span>Next event</span>
            <strong>{stats.nextTournament ? formatDate(stats.nextTournament.date) : "None"}</strong>
            <small>{stats.nextTournament?.name ?? "No published event scheduled"}</small>
          </article>
        </section>

        <div className="admin-workspace">
          <section className="tournament-manager" id="tournaments" aria-labelledby="tournament-manager-title">
            <div className="panel-heading">
              <div>
                <p className="admin-kicker">Database entries</p>
                <h2 id="tournament-manager-title">Tournaments</h2>
              </div>
              <span>{tournaments.length} total</span>
            </div>

            <div className="table-toolbar">
              <label className="admin-search">
                <span aria-hidden="true">⌕</span>
                <span className="sr-only">Search tournaments</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tournament or game"
                />
              </label>
              <div className="visibility-filters" aria-label="Filter by visibility">
                {["All", "Published", "Draft"].map((option) => (
                  <button
                    className={filter === option ? "is-active" : ""}
                    type="button"
                    aria-pressed={filter === option}
                    key={option}
                    onClick={() => setFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="tournament-table" role="table" aria-label="Tournament entries">
              <div className="table-row table-head" role="row">
                <span role="columnheader">Tournament</span>
                <span role="columnheader">Starts</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Visibility</span>
                <span role="columnheader">Action</span>
              </div>

              {visibleTournaments.map((tournament) => (
                <article className="table-row" role="row" key={tournament.id}>
                  <div className="tournament-identity" role="cell">
                    <span className={`game-mark game-${tournament.game.toLowerCase()}`}>
                      {tournament.game.slice(0, 2)}
                    </span>
                    <div>
                      <strong>{tournament.name}</strong>
                      <span>{tournament.game} · {tournament.format}</span>
                    </div>
                  </div>
                  <div className="table-date" role="cell">
                    <strong>{formatDate(tournament.date)}</strong>
                    <span>{formatTime(tournament.time)}</span>
                  </div>
                  <span className={`entry-status${tournament.status === "Registration open" ? " is-open" : ""}`} role="cell">
                    {tournament.status}
                  </span>
                  <span className={`visibility-badge is-${tournament.visibility.toLowerCase()}`} role="cell">
                    <i aria-hidden="true" /> {tournament.visibility}
                  </span>
                  <button className="visibility-action" type="button" onClick={() => toggleVisibility(tournament.id)}>
                    {tournament.visibility === "Published" ? "Unpublish" : "Publish"}
                  </button>
                </article>
              ))}

              {visibleTournaments.length === 0 && (
                <div className="table-empty">
                  <strong>No tournaments found</strong>
                  <span>Try another search or visibility filter.</span>
                </div>
              )}
            </div>
          </section>

          <aside className="create-panel" id="create-tournament" aria-labelledby="create-title">
            <div className="panel-heading create-heading">
              <div>
                <p className="admin-kicker">New database entry</p>
                <h2 id="create-title">Create tournament</h2>
              </div>
              <span className="form-step">01</span>
            </div>

            <div className="tournament-preview">
              <div>
                <span>{form.game}</span>
                <strong>{form.name || "Tournament name"}</strong>
              </div>
              <small>{form.date ? formatDate(form.date) : "Choose a start date"}</small>
            </div>

            <form className="create-form" onSubmit={createTournament}>
              <label className="field-wide">
                <span>Tournament name</span>
                <input name="name" value={form.name} onChange={updateField} placeholder="Sultan Series" maxLength={64} required />
              </label>

              <label>
                <span>Game</span>
                <select name="game" value={form.game} onChange={updateField}>
                  {games.map((game) => <option key={game}>{game}</option>)}
                </select>
              </label>

              <label>
                <span>Public status</span>
                <select name="status" value={form.status} onChange={updateField}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>

              <label>
                <span>Start date</span>
                <input name="date" type="date" value={form.date} onChange={updateField} required />
              </label>

              <label>
                <span>Start time</span>
                <input name="time" type="time" value={form.time} onChange={updateField} required />
              </label>

              <label className="field-wide">
                <span>Format</span>
                <input name="format" value={form.format} onChange={updateField} placeholder="5v5 · Best of 3" maxLength={56} required />
              </label>

              <label className="field-wide">
                <span>Prize</span>
                <input name="prize" value={form.prize} onChange={updateField} placeholder="PKR 50,000 or Prize pool TBA" maxLength={56} required />
              </label>

              <label className="field-wide">
                <span>Image path or URL</span>
                <input name="image" value={form.image} onChange={updateField} placeholder="/images/valorant-tournament.png" required />
              </label>

              <label className="checkbox-field field-wide">
                <input name="featured" type="checkbox" checked={form.featured} onChange={updateField} />
                <span><strong>Feature this tournament</strong><small>Eligible for the homepage tournament carousel.</small></span>
              </label>

              <fieldset className="publish-choice field-wide">
                <legend>Save as</legend>
                <label>
                  <input type="radio" name="visibility" value="Published" checked={form.visibility === "Published"} onChange={updateField} />
                  <span>Published</span>
                </label>
                <label>
                  <input type="radio" name="visibility" value="Draft" checked={form.visibility === "Draft"} onChange={updateField} />
                  <span>Draft</span>
                </label>
              </fieldset>

              <button className="create-submit" type="submit" disabled={saving}>
                {saving
                  ? "Saving to Supabase…"
                  : form.visibility === "Published"
                    ? "Create and publish"
                    : "Save tournament draft"}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </aside>
        </div>

        <footer className="admin-footer">
          <span>Khilafat Esports private administration</span>
          <span>Supabase connected · Shared tournament database</span>
        </footer>
      </main>

      {notice && <div className="admin-notice" role="status"><span aria-hidden="true">✓</span>{notice}</div>}
    </div>
  );
}
