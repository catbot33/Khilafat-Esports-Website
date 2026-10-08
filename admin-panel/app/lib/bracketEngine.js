const terminalStatuses = new Set(["Completed", "Bye"]);

function participantFromEntry(entry, index) {
  return {
    id: entry.id,
    registrationId: entry.id,
    name: entry.team_name || entry.teamName || `Team ${index + 1}`,
    seed: index + 1,
    stats: { played: 0, wins: 0, draws: 0, losses: 0, points: 0 },
    opponents: [],
    lastMatchId: null,
  };
}

function matchRecord({ id, stage, round, order, teamA = null, teamB = null, sourceA = null, sourceB = null, status }) {
  return {
    id,
    stage,
    round,
    order,
    teamA,
    teamB,
    sourceA,
    sourceB,
    scoreA: 0,
    scoreB: 0,
    status: status || (teamA && teamB ? "Ready" : "Pending"),
    winnerId: null,
    loserId: null,
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function participantById(state, id) {
  return state.participants.find((participant) => participant.id === id);
}

function finishBye(match, participantId = null) {
  match.status = "Bye";
  match.winnerId = participantId;
  match.loserId = null;
  match.scoreA = 0;
  match.scoreB = 0;
}

function settleSingleElimination(state) {
  let changed = true;

  while (changed) {
    changed = false;
    const byId = new Map(state.matches.map((match) => [match.id, match]));

    for (const match of state.matches) {
      if (terminalStatuses.has(match.status) || match.status === "Live") continue;

      const sourceA = match.sourceA ? byId.get(match.sourceA) : null;
      const sourceB = match.sourceB ? byId.get(match.sourceB) : null;
      const sourceAReady = !match.sourceA || terminalStatuses.has(sourceA?.status);
      const sourceBReady = !match.sourceB || terminalStatuses.has(sourceB?.status);

      if (match.sourceA && sourceAReady && match.teamA !== sourceA?.winnerId) {
        match.teamA = sourceA?.winnerId || null;
        changed = true;
      }
      if (match.sourceB && sourceBReady && match.teamB !== sourceB?.winnerId) {
        match.teamB = sourceB?.winnerId || null;
        changed = true;
      }

      if (!sourceAReady || !sourceBReady) continue;

      if (match.teamA && match.teamB) {
        if (match.status !== "Ready") {
          match.status = "Ready";
          changed = true;
        }
      } else {
        finishBye(match, match.teamA || match.teamB || null);
        changed = true;
      }
    }
  }

  const finalMatch = state.matches.find((match) => match.round === state.totalRounds && match.order === 1);
  if (finalMatch && terminalStatuses.has(finalMatch.status)) state.status = "Completed";
}

function createSingleElimination(participants) {
  const totalRounds = Math.ceil(Math.log2(participants.length));
  const matches = [];
  let slots = participants.map((participant) => ({ teamId: participant.id, sourceId: null }));

  for (let round = 1; round <= totalRounds; round += 1) {
    const queue = [...slots];
    const nextSlots = [];
    let order = 1;

    while (queue.length > 1) {
      const teamA = queue.shift();
      const teamB = queue.pop();
      const id = `single-r${round}-m${order}`;
      matches.push(matchRecord({
        id,
        stage: "Championship bracket",
        round,
        order,
        teamA: teamA.teamId,
        teamB: teamB.teamId,
        sourceA: teamA.sourceId,
        sourceB: teamB.sourceId,
      }));
      nextSlots.push({ teamId: null, sourceId: id });
      order += 1;
    }

    if (queue.length === 1) {
      const remainingTeam = queue[0];
      const id = `single-r${round}-m${order}`;
      matches.push(matchRecord({
        id,
        stage: "Championship bracket",
        round,
        order,
        teamA: remainingTeam.teamId,
        sourceA: remainingTeam.sourceId,
      }));
      nextSlots.push({ teamId: null, sourceId: id });
    }

    slots = nextSlots;
  }

  const state = { matches, currentRound: 1, totalRounds, metadata: {} };
  settleSingleElimination(state);
  return state;
}

function pairGroup(participantIds, stage, round, prefix, participantMap = null) {
  const matches = [];
  let order = 1;
  const queue = [...participantIds];

  while (queue.length > 1) {
    const teamA = queue.shift();
    const teamB = queue.pop();
    matches.push(matchRecord({
      id: `${prefix}-r${round}-m${order}`,
      stage,
      round,
      order,
      teamA,
      teamB,
      sourceA: participantMap?.get(teamA)?.lastMatchId || null,
      sourceB: participantMap?.get(teamB)?.lastMatchId || null,
    }));
    order += 1;
  }

  if (queue.length === 1) {
    const bye = matchRecord({
      id: `${prefix}-r${round}-m${order}`,
      stage,
      round,
      order,
      teamA: queue[0],
      sourceA: participantMap?.get(queue[0])?.lastMatchId || null,
    });
    finishBye(bye, queue[0]);
    if (participantMap?.get(queue[0])) participantMap.get(queue[0]).lastMatchId = bye.id;
    matches.push(bye);
  }

  return matches;
}

function createDoubleElimination(participants) {
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  return {
    matches: pairGroup(participants.map((participant) => participant.id), "Winners bracket", 1, "double-w", participantMap),
    currentRound: 1,
    totalRounds: null,
    metadata: { resetFinal: false },
  };
}

function applyByePoint(state, participantId) {
  const participant = participantById(state, participantId);
  if (!participant) return;
  participant.stats.played += 1;
  participant.stats.wins += 1;
  participant.stats.points += 1;
}

function swissPairings(state, round) {
  const sorted = [...state.participants].sort((a, b) => (
    b.stats.points - a.stats.points
    || b.stats.wins - a.stats.wins
    || a.seed - b.seed
  ));
  const matches = [];
  let order = 1;

  while (sorted.length > 1) {
    const teamA = sorted.shift();
    let opponentIndex = sorted.findIndex((candidate) => !teamA.opponents.includes(candidate.id));
    if (opponentIndex < 0) opponentIndex = 0;
    const [teamB] = sorted.splice(opponentIndex, 1);
    matches.push(matchRecord({
      id: `swiss-r${round}-m${order}`,
      stage: "Swiss rounds",
      round,
      order,
      teamA: teamA.id,
      teamB: teamB.id,
    }));
    order += 1;
  }

  if (sorted.length === 1) {
    const bye = matchRecord({ id: `swiss-r${round}-m${order}`, stage: "Swiss rounds", round, order, teamA: sorted[0].id });
    finishBye(bye, sorted[0].id);
    applyByePoint(state, sorted[0].id);
    matches.push(bye);
  }

  return matches;
}

function createSwiss(participants) {
  const totalRounds = Math.max(3, Math.ceil(Math.log2(participants.length)));
  const state = { participants, matches: [], currentRound: 1, totalRounds, metadata: {} };
  state.matches = swissPairings(state, 1);
  return state;
}

function createRoundRobin(participants) {
  const ids = participants.map((participant) => participant.id);
  if (ids.length % 2 === 1) ids.push(null);
  const rotating = [...ids];
  const matches = [];
  const totalRounds = rotating.length - 1;

  for (let round = 1; round <= totalRounds; round += 1) {
    let order = 1;
    for (let index = 0; index < rotating.length / 2; index += 1) {
      const teamA = rotating[index];
      const teamB = rotating[rotating.length - 1 - index];
      if (teamA && teamB) {
        matches.push(matchRecord({
          id: `round-robin-r${round}-m${order}`,
          stage: "Round robin",
          round,
          order,
          teamA: round % 2 === 0 ? teamB : teamA,
          teamB: round % 2 === 0 ? teamA : teamB,
        }));
        order += 1;
      }
    }
    rotating.splice(1, 0, rotating.pop());
  }

  return { matches, currentRound: 1, totalRounds, metadata: {} };
}

export function createBracketState(format, entries) {
  if (!Array.isArray(entries) || entries.length < 2) throw new Error("Select at least two teams.");

  const participants = entries.map(participantFromEntry);
  const base = format === "Single Elimination"
    ? createSingleElimination(participants)
    : format === "Double Elimination"
      ? createDoubleElimination(participants)
      : format === "Swiss"
        ? createSwiss(participants)
        : createRoundRobin(participants);

  return {
    version: 1,
    format,
    status: "Setup",
    participants,
    matches: base.matches,
    currentRound: base.currentRound,
    totalRounds: base.totalRounds,
    activeMatchId: null,
    metadata: base.metadata,
  };
}

function recordResult(state, match) {
  const teamA = participantById(state, match.teamA);
  const teamB = participantById(state, match.teamB);
  if (!teamA || !teamB) return;

  teamA.stats.played += 1;
  teamB.stats.played += 1;
  teamA.opponents.push(teamB.id);
  teamB.opponents.push(teamA.id);

  if (match.scoreA === match.scoreB) {
    teamA.stats.draws += 1;
    teamB.stats.draws += 1;
    teamA.stats.points += 0.5;
    teamB.stats.points += 0.5;
    return;
  }

  const winner = match.scoreA > match.scoreB ? teamA : teamB;
  const loser = winner.id === teamA.id ? teamB : teamA;
  winner.stats.wins += 1;
  winner.stats.points += 1;
  loser.stats.losses += 1;
  teamA.lastMatchId = match.id;
  teamB.lastMatchId = match.id;
}

function advanceDoubleElimination(state) {
  const currentMatches = state.matches.filter((match) => match.round === state.currentRound);
  if (currentMatches.length === 0 || !currentMatches.every((match) => terminalStatuses.has(match.status))) return;

  const active = state.participants.filter((participant) => participant.stats.losses < 2);
  if (active.length <= 1) {
    state.status = "Completed";
    state.activeMatchId = null;
    return;
  }

  const nextRound = state.currentRound + 1;
  let nextMatches;

  if (active.length === 2) {
    const isReset = active.every((participant) => participant.stats.losses === 1);
    nextMatches = [matchRecord({
      id: `double-final-r${nextRound}`,
      stage: isReset ? "Grand final reset" : "Grand final",
      round: nextRound,
      order: 1,
      teamA: active[0].id,
      teamB: active[1].id,
      sourceA: active[0].lastMatchId,
      sourceB: active[1].lastMatchId,
    })];
  } else {
    const participantMap = new Map(state.participants.map((participant) => [participant.id, participant]));
    const unbeaten = active.filter((participant) => participant.stats.losses === 0).map((participant) => participant.id);
    const oneLoss = active.filter((participant) => participant.stats.losses === 1).map((participant) => participant.id);
    nextMatches = [
      ...pairGroup(unbeaten, "Winners bracket", nextRound, "double-w", participantMap),
      ...pairGroup(oneLoss, "Elimination bracket", nextRound, "double-l", participantMap),
    ];
  }

  state.currentRound = nextRound;
  state.matches.push(...nextMatches);
}

function advanceSwiss(state) {
  const currentMatches = state.matches.filter((match) => match.round === state.currentRound);
  if (currentMatches.length === 0 || !currentMatches.every((match) => terminalStatuses.has(match.status))) return;

  if (state.currentRound >= state.totalRounds) {
    state.status = "Completed";
    state.activeMatchId = null;
    return;
  }

  state.currentRound += 1;
  state.matches.push(...swissPairings(state, state.currentRound));
}

export function updateBracketMatch(currentState, matchId, scoreA, scoreB, nextStatus) {
  const state = cloneState(currentState);
  const match = state.matches.find((candidate) => candidate.id === matchId);
  if (!match) throw new Error("Match not found.");
  if (!match.teamA || !match.teamB) throw new Error("Both teams must be assigned before scoring.");
  if (terminalStatuses.has(match.status)) throw new Error("Completed matches are locked to protect bracket progression.");

  const parsedScoreA = Number.parseInt(scoreA, 10);
  const parsedScoreB = Number.parseInt(scoreB, 10);
  if (!Number.isInteger(parsedScoreA) || !Number.isInteger(parsedScoreB) || parsedScoreA < 0 || parsedScoreB < 0) {
    throw new Error("Scores must be whole numbers of zero or more.");
  }

  match.scoreA = parsedScoreA;
  match.scoreB = parsedScoreB;

  if (nextStatus === "Live") {
    state.matches.forEach((candidate) => {
      if (candidate.id !== match.id && candidate.status === "Live") candidate.status = "Ready";
    });
    match.status = "Live";
    state.status = "Live";
    state.activeMatchId = match.id;
    return state;
  }

  const drawsAllowed = state.format === "Swiss" || state.format === "Round Robin";
  if (!drawsAllowed && parsedScoreA === parsedScoreB) throw new Error("Elimination matches need a winner.");

  match.status = "Completed";
  match.winnerId = parsedScoreA === parsedScoreB ? null : parsedScoreA > parsedScoreB ? match.teamA : match.teamB;
  match.loserId = parsedScoreA === parsedScoreB ? null : match.winnerId === match.teamA ? match.teamB : match.teamA;
  if (state.activeMatchId === match.id) state.activeMatchId = null;
  recordResult(state, match);

  if (state.format === "Single Elimination") settleSingleElimination(state);
  if (state.format === "Double Elimination") advanceDoubleElimination(state);
  if (state.format === "Swiss") advanceSwiss(state);
  if (state.format === "Round Robin" && state.matches.every((candidate) => terminalStatuses.has(candidate.status))) {
    state.status = "Completed";
  }

  if (state.status !== "Completed") state.status = "Live";
  return state;
}
