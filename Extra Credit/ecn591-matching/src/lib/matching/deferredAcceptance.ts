export type MatchingParticipant = {
  id: string;
  name: string;
  side: "A" | "B";
};

export type MatchingPreference = {
  participant_id: string;
  ranked_participant_ids: unknown;
};

export type DeferredAcceptanceMatch = {
  sideAName: string;
  sideBName: string;
  sideAId: string;
  sideBId: string;
};

export type DeferredAcceptanceResult = {
  matches: DeferredAcceptanceMatch[];
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

export function runDeferredAcceptance(
  participants: MatchingParticipant[],
  preferences: MatchingPreference[],
): DeferredAcceptanceResult {
  const sideA = participants.filter((participant) => participant.side === "A");
  const sideB = participants.filter((participant) => participant.side === "B");

  if (sideA.length === 0 || sideB.length === 0) {
    return {
      matches: [],
      errorMessage: "Cannot run Deferred Acceptance: both sides need participants.",
    };
  }

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const preferenceByParticipantId = new Map(
    preferences.map((preference) => [preference.participant_id, preference]),
  );

  const sideAIds = sideA.map((participant) => participant.id);
  const sideBIds = sideB.map((participant) => participant.id);

  const proposerRankings = new Map<string, string[]>();
  const receiverRankings = new Map<string, string[]>();

  for (const proposer of sideA) {
    const preference = preferenceByParticipantId.get(proposer.id);
    const ranking = normalizeRanking(preference?.ranked_participant_ids);

    if (!ranking || !isStrictRanking(ranking, sideBIds)) {
      return {
        matches: [],
        errorMessage:
          "Some rankings are missing or invalid. Please ensure every participant submitted a complete ranking.",
      };
    }

    proposerRankings.set(proposer.id, ranking);
  }

  for (const receiver of sideB) {
    const preference = preferenceByParticipantId.get(receiver.id);
    const ranking = normalizeRanking(preference?.ranked_participant_ids);

    if (!ranking || !isStrictRanking(ranking, sideAIds)) {
      return {
        matches: [],
        errorMessage:
          "Some rankings are missing or invalid. Please ensure every participant submitted a complete ranking.",
      };
    }

    receiverRankings.set(receiver.id, ranking);
  }

  const receiverRankIndex = new Map<string, Map<string, number>>();
  for (const receiver of sideB) {
    const ranking = receiverRankings.get(receiver.id) ?? [];
    receiverRankIndex.set(
      receiver.id,
      new Map(ranking.map((participantId, index) => [participantId, index])),
    );
  }

  const proposalIndex = new Map(sideAIds.map((id) => [id, 0]));
  const freeProposers = [...sideAIds];
  const receiverPartner = new Map<string, string>();
  const proposerPartner = new Map<string, string>();

  while (freeProposers.length > 0) {
    const proposerId = freeProposers.shift();
    if (!proposerId) {
      continue;
    }

    const ranking = proposerRankings.get(proposerId) ?? [];
    const nextChoiceIndex = proposalIndex.get(proposerId) ?? 0;

    if (nextChoiceIndex >= ranking.length) {
      continue;
    }

    const receiverId = ranking[nextChoiceIndex];
    proposalIndex.set(proposerId, nextChoiceIndex + 1);

    const currentPartnerId = receiverPartner.get(receiverId);
    if (!currentPartnerId) {
      receiverPartner.set(receiverId, proposerId);
      proposerPartner.set(proposerId, receiverId);
      continue;
    }

    const rankMap = receiverRankIndex.get(receiverId) ?? new Map<string, number>();
    const newRank = rankMap.get(proposerId) ?? Number.POSITIVE_INFINITY;
    const currentRank = rankMap.get(currentPartnerId) ?? Number.POSITIVE_INFINITY;

    if (newRank < currentRank) {
      receiverPartner.set(receiverId, proposerId);
      proposerPartner.set(proposerId, receiverId);
      proposerPartner.delete(currentPartnerId);

      if ((proposalIndex.get(currentPartnerId) ?? 0) < (proposerRankings.get(currentPartnerId)?.length ?? 0)) {
        freeProposers.push(currentPartnerId);
      }
    } else if ((proposalIndex.get(proposerId) ?? 0) < ranking.length) {
      freeProposers.push(proposerId);
    }
  }

  const matches: DeferredAcceptanceMatch[] = [];
  for (const [sideAId, sideBId] of proposerPartner.entries()) {
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

  matches.sort((left, right) => left.sideAName.localeCompare(right.sideAName));

  return { matches };
}
