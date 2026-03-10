export type MatchingParticipant = {
  id: string;
  name: string;
  side: "A" | "B";
};

export type MatchingPreference = {
  participant_id: string;
  ranked_participant_ids: unknown;
};

export type ImmediateAcceptanceMatch = {
  sideAName: string;
  sideBName: string;
  sideAId: string;
  sideBId: string;
};

export type ImmediateAcceptanceResult = {
  matches: ImmediateAcceptanceMatch[];
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

export function runImmediateAcceptance(
  participants: MatchingParticipant[],
  preferences: MatchingPreference[],
): ImmediateAcceptanceResult {
  const sideA = participants.filter((participant) => participant.side === "A");
  const sideB = participants.filter((participant) => participant.side === "B");

  if (sideA.length === 0 || sideB.length === 0) {
    return {
      matches: [],
      errorMessage: "Cannot run Immediate Acceptance: both sides need participants.",
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
  const unmatchedProposers = new Set(sideAIds);
  const receiverPartner = new Map<string, string>();

  while (true) {
    const applicationsByReceiver = new Map<string, string[]>();
    let hasAnyApplication = false;

    for (const proposerId of unmatchedProposers) {
      const ranking = proposerRankings.get(proposerId) ?? [];
      const nextChoiceIndex = proposalIndex.get(proposerId) ?? 0;

      if (nextChoiceIndex >= ranking.length) {
        continue;
      }

      const receiverId = ranking[nextChoiceIndex];
      proposalIndex.set(proposerId, nextChoiceIndex + 1);
      hasAnyApplication = true;

      if (receiverPartner.has(receiverId)) {
        continue;
      }

      const currentApplicants = applicationsByReceiver.get(receiverId) ?? [];
      currentApplicants.push(proposerId);
      applicationsByReceiver.set(receiverId, currentApplicants);
    }

    if (!hasAnyApplication) {
      break;
    }

    for (const [receiverId, applicants] of applicationsByReceiver.entries()) {
      if (applicants.length === 0) {
        continue;
      }

      const rankMap = receiverRankIndex.get(receiverId) ?? new Map<string, number>();
      const acceptedProposer = [...applicants].sort((left, right) => {
        const leftRank = rankMap.get(left) ?? Number.POSITIVE_INFINITY;
        const rightRank = rankMap.get(right) ?? Number.POSITIVE_INFINITY;
        return leftRank - rightRank;
      })[0];

      receiverPartner.set(receiverId, acceptedProposer);
      unmatchedProposers.delete(acceptedProposer);
    }
  }

  const matches: ImmediateAcceptanceMatch[] = [];
  for (const [sideBId, sideAId] of receiverPartner.entries()) {
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
