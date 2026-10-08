"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { valorantRankGroups } from "../data/valorantRanks";
import { createClient as createBrowserClient } from "../lib/supabase/client";
import ValorantRankIcon from "./ValorantRankIcon";

const games = ["All", "Valorant", "CS2", "Chess", "Roblox"];
const valorantModes = [
  "Competitive",
  "Unrated",
  "Swiftplay",
  "Premier",
  "Spike Rush",
  "Team Deathmatch",
  "Skirmish",
  "Gauntlet: Glitched",
];
const valorantServerGroups = [
  { region: "Pakistan — nearby servers", servers: ["Riyadh", "Mumbai"] },
  { region: "North America", servers: ["US West (Oregon)", "US West (N. California)", "US East (N. Virginia)", "US Central (Texas)", "US Central (Illinois)", "US Central (Georgia)"] },
  { region: "Latin America", servers: ["Santiago", "Mexico City", "Miami"] },
  { region: "Brazil", servers: ["São Paulo"] },
  { region: "Europe / MENA / Africa", servers: ["Frankfurt", "Paris", "Stockholm", "Istanbul", "London", "Warsaw", "Madrid", "Bahrain", "Cape Town"] },
  { region: "Korea", servers: ["Seoul"] },
  { region: "Asia Pacific", servers: ["Hong Kong", "Tokyo", "Singapore", "Sydney", "Manila"] },
];

function formatScheduledTime(value) {
  if (!value) return "Time not set";

  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function upsertInvitation(invitations, nextInvitation) {
  const exists = invitations.some((invitation) => invitation.id === nextInvitation.id);
  if (!exists) return [nextInvitation, ...invitations];
  return invitations.map((invitation) => (
    invitation.id === nextInvitation.id ? { ...invitation, ...nextInvitation } : invitation
  ));
}

async function copyToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = value;
  temporaryInput.setAttribute("readonly", "");
  temporaryInput.style.position = "fixed";
  temporaryInput.style.opacity = "0";
  document.body.appendChild(temporaryInput);
  temporaryInput.select();
  const copied = document.execCommand("copy");
  temporaryInput.remove();
  if (!copied) throw new Error("Clipboard access was blocked.");
}

export default function InvitationBoard({ initialInvitations, currentUser, databaseReady }) {
  const [activeGame, setActiveGame] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [invitationType, setInvitationType] = useState("now");
  const [ownedInvitations, setOwnedInvitations] = useState(
    initialInvitations.filter((invitation) => invitation.owned),
  );
  const [invitations, setInvitations] = useState(
    initialInvitations.filter((invitation) => !invitation.owned),
  );
  const [requestedInvitations, setRequestedInvitations] = useState(
    initialInvitations.filter((invitation) => invitation.requestSent).map((invitation) => invitation.id),
  );
  const [applicantStatuses, setApplicantStatuses] = useState(() => Object.fromEntries(
    initialInvitations.flatMap((invitation) => (invitation.applicants || [])
      .filter((applicant) => applicant.status && applicant.status !== "Pending")
      .map((applicant) => [`${invitation.id}-${applicant.id}`, applicant.status.toLowerCase()])),
  ));
  const [requestStatuses, setRequestStatuses] = useState(() => Object.fromEntries(
    initialInvitations
      .filter((invitation) => invitation.requestStatus)
      .map((invitation) => [invitation.id, invitation.requestStatus]),
  ));
  const [visiblePartyCodes, setVisiblePartyCodes] = useState([]);
  const [copiedPartyCodeId, setCopiedPartyCodeId] = useState(null);
  const [friendRequestNotice, setFriendRequestNotice] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [requestTarget, setRequestTarget] = useState(null);
  const [actionNotice, setActionNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const requestFormRef = useRef(null);
  const partyCodeCopyTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(partyCodeCopyTimerRef.current), []);

  useEffect(() => {
    if (!requestTarget) return;

    requestFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [requestTarget]);

  useEffect(() => {
    if (!databaseReady) return undefined;

    let socket;
    let active = true;

    async function connectToInvitations() {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      socket = io({
        path: "/socket.io",
        auth: { accessToken: session?.access_token || "" },
      });

      socket.on("invitation:created", (payload) => {
        const owned = payload.ownerId === currentUser?.id;
        const invitation = { ...payload, owned, applicants: payload.applicants || [] };

        if (owned) {
          setOwnedInvitations((current) => upsertInvitation(current, invitation));
          setInvitations((current) => current.filter((item) => item.id !== invitation.id));
        } else {
          setInvitations((current) => upsertInvitation(current, invitation));
          setOwnedInvitations((current) => current.filter((item) => item.id !== invitation.id));
        }
      });

      socket.on("invitation:deleted", ({ id }) => {
        setInvitations((current) => current.filter((invitation) => invitation.id !== id));
        setOwnedInvitations((current) => current.filter((invitation) => invitation.id !== id));
        setRequestedInvitations((current) => current.filter((invitationId) => invitationId !== id));
      });

      socket.on("request:created", (payload) => {
        if (payload.invitationOwnerId === currentUser?.id) {
          setOwnedInvitations((current) => current.map((invitation) => {
            if (invitation.id !== payload.invitationId) return invitation;
            const applicants = invitation.applicants || [];
            const nextApplicants = applicants.some((applicant) => applicant.id === payload.applicant.id)
              ? applicants.map((applicant) => applicant.id === payload.applicant.id ? payload.applicant : applicant)
              : [payload.applicant, ...applicants];
            return { ...invitation, applicants: nextApplicants };
          }));
        }

        if (payload.requesterId === currentUser?.id) {
          setRequestedInvitations((current) => (
            current.includes(payload.invitationId) ? current : [...current, payload.invitationId]
          ));
          setRequestStatuses((current) => ({ ...current, [payload.invitationId]: "Pending" }));
        }
      });

      socket.on("request:updated", (payload) => {
        if (payload.invitationOwnerId === currentUser?.id) {
          setOwnedInvitations((current) => current.map((invitation) => (
            invitation.id === payload.invitationId
              ? {
                  ...invitation,
                  applicants: (invitation.applicants || []).map((applicant) => (
                    applicant.id === payload.requestId ? { ...applicant, status: payload.status } : applicant
                  )),
                }
              : invitation
          )));
          setApplicantStatuses((current) => ({
            ...current,
            [`${payload.invitationId}-${payload.requestId}`]: payload.status.toLowerCase(),
          }));
        }

        if (payload.requesterId === currentUser?.id) {
          setRequestStatuses((current) => ({ ...current, [payload.invitationId]: payload.status }));
          setActionNotice(`Your join request was ${payload.status.toLowerCase()}.`);
        }
      });
    }

    connectToInvitations();
    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [currentUser?.id, databaseReady]);

  const visibleInvitations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invitations.filter((invitation) => {
      const matchesGame = activeGame === "All" || invitation.game === activeGame;
      const searchableText = [
        invitation.game,
        invitation.title,
        invitation.message,
        invitation.host,
        invitation.level,
        invitation.region,
        invitation.mode,
        invitation.timing,
      ]
        .join(" ")
        .toLowerCase();

      return matchesGame && (!query || searchableText.includes(query));
    });
  }, [activeGame, invitations, search]);

  async function createInvitation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const timing = data.get("timing") === "later" ? "later" : "now";
    const scheduledTime = timing === "later"
      ? `${data.get("playDate")}T${data.get("playTime")}:00+05:00`
      : "";
    setSaving(true);
    setActionNotice("");

    const payload = {
      game: data.get("game"),
      title: data.get("title"),
      message: data.get("message"),
      host: data.get("host"),
      level: data.get("level"),
      region: data.get("region"),
      mode: data.get("mode"),
      timing,
      partyCode: timing === "now" ? data.get("partyCode") : "",
      discord: timing === "later" ? data.get("discord") : "",
      time: scheduledTime,
    };

    const response = await fetch("/api/player-invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setActionNotice(result?.error || "Invitation could not be saved.");
      setSaving(false);
      return;
    }

    const invitation = result?.invitation ? {
      ...result.invitation,
      owned: true,
    } : {
      id: result.id,
      owned: true,
      game: payload.game,
      title: payload.title,
      message: payload.message,
      host: payload.host,
      creator: currentUser?.displayName || currentUser?.username,
      level: payload.level,
      region: payload.region,
      mode: payload.mode,
      timing,
      partyCode: payload.partyCode,
      discord: payload.discord,
      time: timing === "later" ? formatScheduledTime(payload.time) : "Playing now",
      applicants: [],
    };

    setOwnedInvitations((currentInvitations) => upsertInvitation(currentInvitations, invitation));
    setShowForm(false);
    setInvitationType("now");
    setSaving(false);
    form.reset();
  }

  function openJoinRequest(invitation) {
    if (!currentUser) {
      window.location.assign("/signup?mode=login&next=/looking-for-player");
      return;
    }
    if (!databaseReady) {
      setActionNotice("Player accounts need the Supabase migration before requests can be saved.");
      return;
    }
    setActionNotice("");
    setRequestTarget(invitation);
  }

  async function submitJoinRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setActionNotice("");

    const response = await fetch(`/api/player-invitations/${requestTarget.id}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        riotId: data.get("riotId"),
        currentRank: data.get("currentRank"),
        discordUsername: data.get("discordUsername"),
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setActionNotice(result?.error || "Your request could not be sent.");
      setSaving(false);
      return;
    }

    setRequestedInvitations((current) => (
      current.includes(requestTarget.id) ? current : [...current, requestTarget.id]
    ));
    setRequestStatuses((current) => ({ ...current, [requestTarget.id]: "Pending" }));
    setFriendRequestNotice({
      host: requestTarget.host,
      discord: requestTarget.discord || "the creator's listed Discord",
    });
    setRequestTarget(null);
    setSaving(false);
  }

  async function showAndCopyPartyCode(invitation) {
    setVisiblePartyCodes((current) => (
      current.includes(invitation.id) ? current : [...current, invitation.id]
    ));

    try {
      await copyToClipboard(invitation.partyCode);
      setCopiedPartyCodeId(invitation.id);
      window.clearTimeout(partyCodeCopyTimerRef.current);
      partyCodeCopyTimerRef.current = window.setTimeout(() => setCopiedPartyCodeId(null), 1800);
    } catch {
      setActionNotice("Party code is shown, but clipboard access was blocked. Select the code to copy it manually.");
    }
  }

  async function deleteInvitation(id) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/player-invitations/${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setActionNotice(result?.error || "Invitation could not be deleted.");
      setPendingDeleteId(null);
      setSaving(false);
      return;
    }

    setOwnedInvitations((current) => current.filter((invitation) => invitation.id !== id));
    setPendingDeleteId(null);
    setSaving(false);
  }

  async function updateApplicant(invitationId, applicantId, status) {
    const response = await fetch(`/api/player-invitations/${invitationId}/requests/${applicantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "accepted" ? "Accepted" : "Declined" }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setActionNotice(result?.error || "Request status could not be updated.");
      return;
    }

    setApplicantStatuses((current) => ({
      ...current,
      [`${invitationId}-${applicantId}`]: status,
    }));
  }

  return (
    <div className="invitation-board">
      <div className="invitation-actions">
        <label className="invitation-search">
          <span className="sr-only">Search invitations</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by game, rank, region or host"
          />
        </label>

        <button
          className="create-invitation-button"
          type="button"
          aria-expanded={showForm}
          onClick={() => {
            if (!currentUser) {
              window.location.assign("/signup?next=/looking-for-player");
              return;
            }
            if (!databaseReady) {
              setActionNotice("Player accounts need the Supabase migration before invitations can be saved.");
              return;
            }
            setActionNotice("");
            setShowForm((current) => !current);
          }}
        >
          <span aria-hidden="true">{showForm ? "×" : "+"}</span>
          {showForm ? "Close form" : "Create invitation"}
        </button>
      </div>

      {actionNotice && <p className="invitation-action-notice" role="status">{actionNotice}</p>}

      {showForm && (
        <form className="invitation-form" onSubmit={createInvitation}>
          <div className="invitation-form-heading">
            <div>
              <p className="section-kicker">Start a stack</p>
              <h2>Create an invitation</h2>
            </div>
            <p>{invitationType === "now" ? "Share a party code with players who can join immediately." : "Plan a session and review requests before inviting players."}</p>
          </div>

          <div className="invitation-type-picker" aria-label="Choose when you need players">
            <button
              className={invitationType === "now" ? "is-active" : ""}
              type="button"
              aria-pressed={invitationType === "now"}
              onClick={() => setInvitationType("now")}
            >
              <span>Play now</span>
              <small>Share a party code</small>
            </button>
            <button
              className={invitationType === "later" ? "is-active" : ""}
              type="button"
              aria-pressed={invitationType === "later"}
              onClick={() => setInvitationType("later")}
            >
              <span>Play later</span>
              <small>Collect join requests</small>
            </button>
          </div>

          <input type="hidden" name="timing" value={invitationType} readOnly />

          <div className="invitation-form-grid">
            <label>
              <span>Game</span>
              <select name="game" defaultValue="Valorant" required>
                <option>Valorant</option>
              </select>
            </label>

            <label className="form-field-wide">
              <span>Invitation title</span>
              <input name="title" maxLength={72} placeholder="What kind of player are you looking for?" required />
            </label>

            <label className="form-field-full">
              <span>Message</span>
              <textarea name="message" rows={3} maxLength={220} placeholder="Share your play style, expectations and anything teammates should know." required />
            </label>

            <label>
              <span>Your Riot username</span>
              <input name="host" maxLength={32} placeholder="Raven#KHI" required />
            </label>

            <label>
              <span>Your rank</span>
              <select name="level" defaultValue="Unranked" required>
                {valorantRankGroups.map((group) => (
                  <optgroup label={group.tier} key={group.tier}>
                    {group.divisions.map((rank) => <option key={rank}>{rank}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>

            <label>
              <span>Region / server</span>
              <select name="region" defaultValue="Pakistan — nearby servers / Riyadh" required>
                {valorantServerGroups.map((group) => (
                  <optgroup label={group.region} key={group.region}>
                    {group.servers.map((server) => (
                      <option value={`${group.region} / ${server}`} key={server}>{server}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label>
              <span>Valorant mode</span>
              <select name="mode" defaultValue="Competitive" required>
                {valorantModes.map((mode) => <option key={mode}>{mode}</option>)}
              </select>
            </label>

            {invitationType === "now" ? (
              <label className="form-field-full">
                <span>Party code</span>
                <input name="partyCode" maxLength={32} placeholder="Enter the in-game party code" required />
              </label>
            ) : (
              <>
                <label className="form-field-wide">
                  <span>Discord username</span>
                  <input name="discord" maxLength={40} placeholder="raven.khi" required />
                </label>
                <label>
                  <span>Playing date</span>
                  <input name="playDate" type="date" onClick={(event) => event.currentTarget.showPicker?.()} required />
                </label>
                <label>
                  <span>Starting time</span>
                  <input name="playTime" type="time" onClick={(event) => event.currentTarget.showPicker?.()} required />
                </label>
              </>
            )}
          </div>

          <div className="invitation-form-footer">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish invitation"}</button>
          </div>
        </form>
      )}

      <section className="owned-invitations" aria-labelledby="owned-invitations-title">
        <div className="owned-invitations-heading">
          <div>
            <p className="section-kicker">Manage your stack</p>
            <h2 id="owned-invitations-title">Your invitations</h2>
          </div>
          <p>{ownedInvitations.length} active</p>
        </div>

        <div className="owned-invitation-list">
          {ownedInvitations.map((invitation) => (
            <article className="owned-invitation" key={invitation.id}>
              <div className="owned-invitation-summary">
                <div className="owned-invitation-labels">
                  <span>{invitation.game}</span>
                  <span className="owned-invitation-status">Open</span>
                </div>
                <h3>{invitation.title}</h3>
                <div className="owned-invitation-rank">
                  <ValorantRankIcon rank={invitation.level} compact />
                  <span>{invitation.level}</span>
                </div>
                <p>{invitation.mode} · {invitation.time}</p>
                <button
                  className={`delete-invitation-button${pendingDeleteId === invitation.id ? " is-confirming" : ""}`}
                  type="button"
                  disabled={saving}
                  onClick={() => deleteInvitation(invitation.id)}
                  onBlur={() => setPendingDeleteId((current) => current === invitation.id ? null : current)}
                >
                  {pendingDeleteId === invitation.id ? "Confirm delete" : "Delete invitation"}
                </button>
              </div>

              {invitation.timing === "now" ? (
                <div className="owned-party-code">
                  <p>Party code</p>
                  <strong>{invitation.partyCode}</strong>
                  <span>Players can join directly. Join requests are disabled.</span>
                </div>
              ) : (
                <div className="join-requests">
                  <div className="join-requests-heading">
                    <h3>Requests to join</h3>
                    <span>{invitation.applicants.length}</span>
                  </div>

                  {invitation.applicants.length > 0 ? (
                    <div className="join-request-list">
                      {invitation.applicants.map((applicant) => {
                        const statusKey = `${invitation.id}-${applicant.id}`;
                        const status = applicantStatuses[statusKey];

                        return (
                          <div className="join-request" key={applicant.id}>
                            <span className="applicant-mark" aria-hidden="true">
                              {applicant.name.slice(0, 2)}
                            </span>
                            <div className="applicant-details">
                              <strong>{applicant.name}</strong>
                            <div className="applicant-rank">
                              <ValorantRankIcon rank={applicant.level} compact />
                              <span>{applicant.level} · {applicant.role}</span>
                            </div>
                            </div>

                            {status ? (
                              <span className={`applicant-decision is-${status}`}>
                                {status === "accepted" ? "Accepted" : "Declined"}
                              </span>
                            ) : (
                              <div className="request-actions">
                                <button
                                  type="button"
                                  onClick={() => updateApplicant(invitation.id, applicant.id, "declined")}
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateApplicant(invitation.id, applicant.id, "accepted")}
                                >
                                  Accept
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-join-requests">No one has asked to join yet.</p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="invitation-toolbar">
        <div className="invitation-filters" aria-label="Filter invitations by game">
          {games.map((game) => (
            <button
              className={`filter-button${activeGame === game ? " is-active" : ""}`}
              type="button"
              key={game}
              aria-pressed={activeGame === game}
              onClick={() => setActiveGame(game)}
            >
              {game}
            </button>
          ))}
        </div>

        <p className="directory-count" aria-live="polite">
          {visibleInvitations.length} {visibleInvitations.length === 1 ? "invitation" : "invitations"}
        </p>
      </div>

      {friendRequestNotice && (
        <div className="friend-request-notice" role="status">
          <div>
            <strong>Request sent</strong>
            <p>You also need to send a friend request to the creator&apos;s accounts: <span>{friendRequestNotice.host}</span> in VALORANT and <span>{friendRequestNotice.discord}</span> on Discord.</p>
          </div>
          <button type="button" aria-label="Close notification" onClick={() => setFriendRequestNotice(null)}>×</button>
        </div>
      )}

      {requestTarget && (
        <div className="join-request-form-shell" ref={requestFormRef}>
          <form className="join-request-form" onSubmit={submitJoinRequest}>
            <div className="join-request-form-heading">
              <div>
                <p className="section-kicker">Place a request</p>
                <h2>{requestTarget.title}</h2>
              </div>
              <button type="button" aria-label="Close join request form" onClick={() => setRequestTarget(null)}>×</button>
            </div>
            <div className="join-request-fields">
              <label>
                <span>Riot username with tag</span>
                <input name="riotId" placeholder="Player#KHI" maxLength={32} required />
              </label>
              <label>
                <span>Current rank</span>
                <select name="currentRank" defaultValue="Unranked" required>
                  {valorantRankGroups.map((group) => (
                    <optgroup label={group.tier} key={group.tier}>
                      {group.divisions.map((rank) => <option key={rank}>{rank}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                <span>Discord username</span>
                <input name="discordUsername" placeholder="player.khi" maxLength={40} required />
              </label>
            </div>
            <div className="join-request-form-actions">
              <button type="button" onClick={() => setRequestTarget(null)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Sending…" : "Send request"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="invitation-list">
        {visibleInvitations.map((invitation) => {
          const requestSent = requestedInvitations.includes(invitation.id);
          const requestStatus = requestStatuses[invitation.id];
          const partyCodeVisible = visiblePartyCodes.includes(invitation.id);
          const partyCodeCopied = copiedPartyCodeId === invitation.id;

          return (
            <article className="invitation-card" key={invitation.id}>
              <div className={`invitation-game invitation-game-${invitation.game.toLowerCase()}`}>
                <span>{invitation.game}</span>
                <strong aria-hidden="true">{invitation.game.slice(0, 2)}</strong>
              </div>

              <div className="invitation-copy">
                <p className="invitation-host">Hosted by {invitation.host}</p>
                <h2>{invitation.title}</h2>
                <p>{invitation.message}</p>
              </div>

              <dl className="invitation-meta">
                <div>
                  <dt>Region</dt>
                  <dd>{invitation.region}</dd>
                </div>
                <div>
                  <dt>Rank</dt>
                  <dd className="invitation-rank-value">
                    {invitation.game === "Valorant" && <ValorantRankIcon rank={invitation.level} />}
                    <span>{invitation.level}</span>
                  </dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{invitation.mode}</dd>
                </div>
                <div>
                  <dt>Playing</dt>
                  <dd>{invitation.time}</dd>
                </div>
              </dl>

              {invitation.timing === "now" ? (
                <button
                  className={`join-invitation-button party-code-button${partyCodeVisible ? " is-visible" : ""}`}
                  type="button"
                  aria-label={partyCodeVisible ? `Copy party code ${invitation.partyCode}` : "Show and copy party code"}
                  onClick={() => showAndCopyPartyCode(invitation)}
                >
                  {partyCodeVisible ? (
                    <><small aria-live="polite">{partyCodeCopied ? "Copied to clipboard" : "Party code · click to copy"}</small><strong>{invitation.partyCode}</strong></>
                  ) : (
                    <>View party code<span aria-hidden="true">→</span></>
                  )}
                </button>
              ) : (
                <button
                  className={`join-invitation-button${requestSent ? " is-sent" : ""}`}
                  type="button"
                  disabled={requestSent}
                  onClick={() => openJoinRequest(invitation)}
                >
                  {requestStatus && requestStatus !== "Pending" ? requestStatus : requestSent ? "Request sent" : "Ask to join"}
                  <span aria-hidden="true">{requestStatus === "Declined" ? "×" : requestSent ? "✓" : "→"}</span>
                </button>
              )}
            </article>
          );
        })}

        {visibleInvitations.length === 0 && (
          <div className="invitation-empty">
            <p className="section-kicker">No matches</p>
            <h2>No invitations found</h2>
            <p>Try another search or create the first invitation for this game.</p>
          </div>
        )}
      </div>
    </div>
  );
}
