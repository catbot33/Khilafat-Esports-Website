import { valorantRanks } from "../../data/valorantRanks";
import { createClient } from "../../lib/supabase/server";

const MAX_LENGTHS = {
  teamName: 64,
  discordName: 64,
  riotId: 40,
};

const ranks = new Set(valorantRanks);

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!projectUrl || !publishableKey) {
    return Response.json({ error: "Tournament registration is not connected yet." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid registration data." }, { status: 400 });
  }

  if (body.website) return Response.json({ ok: true });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in before submitting a tournament entry.", signInRequired: true }, { status: 401 });
  }

  const tournamentSlug = clean(body.tournamentSlug, 100);
  const teamName = clean(body.teamName, MAX_LENGTHS.teamName);
  const discordName = clean(body.discordName, MAX_LENGTHS.discordName);
  const riotId = clean(body.riotId, MAX_LENGTHS.riotId);
  const currentRank = clean(body.currentRank, 20);
  const teammates = Array.isArray(body.teammates)
    ? body.teammates.slice(0, 4).map((teammate) => ({
        discordName: clean(teammate?.discordName, MAX_LENGTHS.discordName),
        riotId: clean(teammate?.riotId, MAX_LENGTHS.riotId),
        currentRank: clean(teammate?.currentRank, 20),
      }))
    : [];

  if (!tournamentSlug || !teamName || !discordName || !riotId.includes("#") || !ranks.has(currentRank)) {
    return Response.json({ error: "Complete your team, Discord, Riot ID, and current rank." }, { status: 400 });
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, game, status, team_size")
    .eq("slug", tournamentSlug)
    .eq("visibility", "Published")
    .maybeSingle();

  if (tournamentError?.code === "PGRST204" || /team_size|schema cache/i.test(tournamentError?.message ?? "")) {
    return Response.json({ error: "Tournament formats need the latest registration migration." }, { status: 503 });
  }

  if (!tournament || tournament.game !== "Valorant") {
    return Response.json({ error: "This Valorant tournament is not available." }, { status: 404 });
  }

  if (tournament.status !== "Registration open") {
    return Response.json({ error: "Registration is not open for this tournament." }, { status: 409 });
  }

  const teamSize = [1, 2, 5].includes(Number(tournament.team_size)) ? Number(tournament.team_size) : 5;
  const expectedTeammates = teamSize - 1;
  const incompleteRoster = teammates.length !== expectedTeammates
    || teammates.some((teammate) => !teammate.discordName || !teammate.riotId.includes("#") || !ranks.has(teammate.currentRank));

  if (incompleteRoster) {
    return Response.json({
      error: `${teamSize}v${teamSize} registration requires exactly ${teamSize} complete player ${teamSize === 1 ? "entry" : "entries"}.`,
    }, { status: 400 });
  }

  const rosterRiotIds = [riotId, ...teammates.map((teammate) => teammate.riotId.toLowerCase())];
  if (new Set(rosterRiotIds.map((id) => id.toLowerCase())).size !== teamSize) {
    return Response.json({ error: "Every roster slot must use a different Riot ID." }, { status: 400 });
  }

  const entryType = teamSize === 1 ? "Solo" : "Stack";

  const { data: existingRegistration, error: existingError } = await supabase
    .from("tournament_registrations")
    .select("id, status")
    .eq("tournament_id", tournament.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError?.code === "PGRST204" || /user_id|schema cache/i.test(existingError?.message ?? "")) {
    return Response.json({ error: "Tournament accounts need the latest registration migration." }, { status: 503 });
  }

  if (existingRegistration) {
    return Response.json({ error: "You have already submitted an entry for this tournament.", alreadySubmitted: true }, { status: 409 });
  }

  const { data: registration, error } = await supabase
    .from("tournament_registrations")
    .insert({
      tournament_id: tournament.id,
      user_id: user.id,
      team_name: teamName,
      discord_name: discordName,
      riot_id: riotId,
      current_rank: currentRank,
      entry_type: entryType,
      needs_teammate: false,
      teammates,
      status: "Pending",
    })
    .select("id, status")
    .single();

  if (!error) return Response.json({ ok: true, registration }, { status: 201 });

  if (error.code === "PGRST204" || /user_id|schema cache/i.test(error.message ?? "")) {
    return Response.json({ error: "Tournament accounts need the latest registration migration." }, { status: 503 });
  }

  if (error.code === "23505") {
    const { data: ownRegistration } = await supabase
      .from("tournament_registrations")
      .select("id")
      .eq("tournament_id", tournament.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownRegistration) {
      return Response.json({ error: "You have already submitted an entry for this tournament.", alreadySubmitted: true }, { status: 409 });
    }

    return Response.json({ error: "This Riot ID already has an entry submitted for the tournament." }, { status: 409 });
  }

  return Response.json(
    { error: "Registration could not be saved. Check the Supabase registration-table migration." },
    { status: 500 },
  );
}

