export type MatchingParticipant = {
  id: string;
  name: string;
  side: "A" | "B";
};

export type MatchingPreference = {
  participant_id: string;
  ranked_participant_ids: unknown;
};

export type TopTradingCyclesMatch = {
  sideAName: string;
  sideBName: string;
  sideAId: string;
  sideBId: string;
};

export type TopTradingCyclesResult = {
  matches: TopTradingCyclesMatch[];
  errorMessage?: string;
};

function normalizeRanking(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const allStrings = value.every((entry) => typeof entry === "string");
  if (!allStrings) {
    return null;
  }

  return value as string[];
}

function isStrictRanking(ranking: string[], expectedIds: string[]): boolean {
  if (ranking.length !== expectedIds.length) {
    return false;
  }

  const expectedSet = new Set(expectedIds);
  const rankingSet = new Set(ranking);

  if (rankingSet.size !== ranking.length) {
    return false;
  }

  return ranking.every((id) => expectedSet.has(id));
}

function findFirstCycle(startNodeId: string, nextNodeById: Map<string, string>): string[] | null {
  const visitIndexByNode = new Map<string, number>();
  const path: string[] = [];

  let currentNodeId: string | undefined = startNodeId;

  while (currentNodeId) {
    const seenAt = visitIndexByNode.get(currentNodeId);
    if (seenAt !== undefined) {
      return path.slice(seenAt);
    }

    visitIndexByNode.set(currentNodeId, path.length);
    path.push(currentNodeId);

    currentNodeId = nextNodeById.get(currentNodeId);
  }

  return null;
}

export function runTopTradingCycles(
  participants: MatchingParticipant[],
  preferences: MatchingPreference[],
): TopTradingCyclesResult {
  const sideA = participants.filter((participant) => participant.side === "A");
  const sideB = participants.filter((participant) => participant.side === "B");

  if (sideA.length === 0 || sideB.length === 0) {
    return {
      matches: [],
      errorMessage: "Cannot run Top Trading Cycles: both sides need participants.",
    };
  }

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const preferenceByParticipantId = new Map(
    preferences.map((preference) => [preference.participant_id, preference]),
  );

  const sideAIds = sideA.map((participant) => participant.id);
  const sideBIds = sideB.map((participant) => participant.id);

  const rankingsByParticipantId = new Map<string, string[]>();

  for (const participant of participants) {
    const preference = preferenceByParticipantId.get(participant.id);
    const ranking = normalizeRanking(preference?.ranked_participant_ids);
    const expectedIds = participant.side === "A" ? sideBIds : sideAIds;

    if (!ranking || !isStrictRanking(ranking, expectedIds)) {
      return {
        matches: [],
        errorMessage:
          "Some rankings are missing or invalid. Please ensure every participant submitted a complete ranking.",
      };
    }

    rankingsByParticipantId.set(participant.id, ranking);
  }

  const remainingAIds = new Set(sideAIds);
  const remainingBIds = new Set(sideBIds);
  const matches: TopTradingCyclesMatch[] = [];

  while (remainingAIds.size > 0 && remainingBIds.size > 0) {
    const nextNodeById = new Map<string, string>();

    for (const sideAId of remainingAIds) {
      const ranking = rankingsByParticipantId.get(sideAId) ?? [];
      const nextChoiceId = ranking.find((candidateId) => remainingBIds.has(candidateId));

      if (!nextChoiceId) {
        continue;
      }

      nextNodeById.set(sideAId, nextChoiceId);
    }

    for (const sideBId of remainingBIds) {
      const ranking = rankingsByParticipantId.get(sideBId) ?? [];
      const nextChoiceId = ranking.find((candidateId) => remainingAIds.has(candidateId));

      if (!nextChoiceId) {
        continue;
      }

      nextNodeById.set(sideBId, nextChoiceId);
    }

    const cycleList: string[][] = [];
    const claimedNodes = new Set<string>();

    for (const nodeId of nextNodeById.keys()) {
      if (claimedNodes.has(nodeId)) {
        continue;
      }

      const cycle = findFirstCycle(nodeId, nextNodeById);
      if (!cycle || cycle.length === 0) {
        continue;
      }

      cycleList.push(cycle);
      for (const cycleNodeId of cycle) {
        claimedNodes.add(cycleNodeId);
      }
    }

    if (cycleList.length === 0) {
      break;
    }

    for (const cycle of cycleList) {
      const cycleAIds = cycle.filter((nodeId) => remainingAIds.has(nodeId));

      for (const sideAId of cycleAIds) {
        const sideBId = nextNodeById.get(sideAId);
        if (!sideBId || !remainingBIds.has(sideBId)) {
          continue;
        }

        const sideAName = participantById.get(sideAId)?.name;
        const sideBName = participantById.get(sideBId)?.name;

        if (!sideAName || !sideBName) {
          continue;
        }

        matches.push({
          sideAId,
          sideAName,
          sideBId,
          sideBName,
        });
      }

      for (const nodeId of cycle) {
        remainingAIds.delete(nodeId);
        remainingBIds.delete(nodeId);
      }
    }
  }

  matches.sort((left, right) => left.sideAName.localeCompare(right.sideAName));

  return { matches };
}
