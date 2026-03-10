"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  runDeferredAcceptance,
  type MatchingParticipant,
  type MatchingPreference,
} from "@/lib/matching/deferredAcceptance";
import { runImmediateAcceptance } from "@/lib/matching/immediateAcceptance";
import { runTopTradingCycles } from "@/lib/matching/topTradingCycles";

type SessionRecord = {
  id: string;
  code: string;
  title: string;
  size_per_side: number;
  status: "lobby" | "ranking" | string;
};

type ParticipantRecord = {
  id: string;
  name: string;
  side: "A" | "B";
};

type PreferenceRecord = {
  participant_id: string;
  ranked_participant_ids: unknown;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_ANON_KEY: string = supabaseAnonKey;

export default function SessionPageClient() {
  const params = useParams<{ code: string }>();
  const sessionCode = (params.code ?? "").toUpperCase();
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [submittedParticipantIds, setSubmittedParticipantIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<PreferenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showRankingResults, setShowRankingResults] = useState(false);

  const supabaseNoStore = useMemo(
    () =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, {
              ...init,
              cache: "no-store",
            }),
        },
      }),
    [],
  );

  useEffect(() => {
    let ignore = false;

    async function loadSessionData() {
      setLoading(true);
      setNotFound(false);

      const { data: foundSession, error: sessionError } = await supabaseNoStore
        .from("sessions")
        .select("id, code, title, size_per_side, status")
        .eq("code", sessionCode)
        .maybeSingle();

      if (ignore) {
        return;
      }

      if (sessionError || !foundSession) {
        setSession(null);
        setParticipants([]);
        setSubmittedParticipantIds([]);
        setPreferences([]);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: foundParticipants, error: participantsError } = await supabaseNoStore
        .from("participants")
        .select("id, name, side")
        .eq("session_id", foundSession.id);

      if (ignore) {
        return;
      }

      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
      }

      const { data: foundPreferences } = await supabaseNoStore
        .from("preferences")
        .select("participant_id, ranked_participant_ids")
        .eq("session_id", foundSession.id);

      if (ignore) {
        return;
      }

      const submittedIds = (foundPreferences ?? []).map(
        (preference) => (preference as PreferenceRecord).participant_id,
      );

      setSession(foundSession);
      setParticipants((foundParticipants ?? []) as ParticipantRecord[]);
      setSubmittedParticipantIds(submittedIds);
      setPreferences((foundPreferences ?? []) as PreferenceRecord[]);
      setLoading(false);
    }

    if (sessionCode) {
      loadSessionData();
    }

    return () => {
      ignore = true;
    };
  }, [sessionCode, supabaseNoStore]);

  const sideAParticipants = useMemo(
    () => participants.filter((participant) => participant.side === "A"),
    [participants],
  );

  const sideBParticipants = useMemo(
    () => participants.filter((participant) => participant.side === "B"),
    [participants],
  );

  const submittedParticipants = useMemo(
    () => participants.filter((participant) => submittedParticipantIds.includes(participant.id)),
    [participants, submittedParticipantIds],
  );

  const pendingParticipants = useMemo(
    () => participants.filter((participant) => !submittedParticipantIds.includes(participant.id)),
    [participants, submittedParticipantIds],
  );

  const deferredAcceptanceResult = useMemo(() => {
    if (!session || session.status !== "results") {
      return null;
    }

    const algorithmParticipants: MatchingParticipant[] = participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      side: participant.side,
    }));

    const algorithmPreferences: MatchingPreference[] = preferences.map((preference) => ({
      participant_id: preference.participant_id,
      ranked_participant_ids: preference.ranked_participant_ids,
    }));

    return runDeferredAcceptance(algorithmParticipants, algorithmPreferences);
  }, [participants, preferences, session]);

  const immediateAcceptanceResult = useMemo(() => {
    if (!session || session.status !== "results") {
      return null;
    }

    const algorithmParticipants: MatchingParticipant[] = participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      side: participant.side,
    }));

    const algorithmPreferences: MatchingPreference[] = preferences.map((preference) => ({
      participant_id: preference.participant_id,
      ranked_participant_ids: preference.ranked_participant_ids,
    }));

    return runImmediateAcceptance(algorithmParticipants, algorithmPreferences);
  }, [participants, preferences, session]);

  const topTradingCyclesResult = useMemo(() => {
    if (!session || session.status !== "results") {
      return null;
    }

    const algorithmParticipants: MatchingParticipant[] = participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      side: participant.side,
    }));

    const algorithmPreferences: MatchingPreference[] = preferences.map((preference) => ({
      participant_id: preference.participant_id,
      ranked_participant_ids: preference.ranked_participant_ids,
    }));

    return runTopTradingCycles(algorithmParticipants, algorithmPreferences);
  }, [participants, preferences, session]);

  const sideACount = sideAParticipants.length;

  const comparisonNote = useMemo(() => {
    if (session?.status !== "results") {
      return null;
    }

    const hasAnyError =
      Boolean(deferredAcceptanceResult?.errorMessage) ||
      Boolean(immediateAcceptanceResult?.errorMessage) ||
      Boolean(topTradingCyclesResult?.errorMessage);

    if (hasAnyError) {
      return "Comparison unavailable because at least one mechanism could not be computed.";
    }

    const encode = (pairs: Array<{ sideAId: string; sideBId: string }>) =>
      [...pairs]
        .map((pair) => `${pair.sideAId}:${pair.sideBId}`)
        .sort()
        .join("|");

    const daKey = encode(deferredAcceptanceResult?.matches ?? []);
    const iaKey = encode(immediateAcceptanceResult?.matches ?? []);
    const ttcKey = encode(topTradingCyclesResult?.matches ?? []);

    if (daKey === iaKey && iaKey === ttcKey) {
      return "All three mechanisms produce identical matchings.";
    }

    return "The mechanisms produce different outcomes for this session.";
  }, [
    deferredAcceptanceResult?.errorMessage,
    deferredAcceptanceResult?.matches,
    immediateAcceptanceResult?.errorMessage,
    immediateAcceptanceResult?.matches,
    session?.status,
    topTradingCyclesResult?.errorMessage,
    topTradingCyclesResult?.matches,
  ]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
        <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
          <p className="text-zinc-700 dark:text-zinc-300">Loading session...</p>
        </section>
      </main>
    );
  }

  if (notFound || !session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
        <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            Session not found
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          {session.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Session code: {session.code}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Size per side: {session.size_per_side}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Status: {session.status}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Side A ({sideAParticipants.length})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {sideAParticipants.length === 0 ? <li>No participants yet</li> : null}
              {sideAParticipants.map((participant) => (
                <li key={participant.id}>{participant.name}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Side B ({sideBParticipants.length})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {sideBParticipants.length === 0 ? <li>No participants yet</li> : null}
              {sideBParticipants.map((participant) => (
                <li key={participant.id}>{participant.name}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <p className="font-medium">Session Progress</p>
          {session.status === "results" ? (
            <p>All rankings submitted. Ready for results.</p>
          ) : session.status === "ranking" ? (
            <p>Ready for rankings</p>
          ) : (
            <p>Waiting for participants</p>
          )}
          <p>Participants and submission status are shown below.</p>
          {session.status === "ranking" ? (
            <p>
              <Link
                href={`/session/${session.code}/rank`}
                className="font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                Go to ranking page
              </Link>
            </p>
          ) : null}
        </div>

        {session.status === "ranking" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Submissions: {submittedParticipants.length} / {participants.length}
            </p>

            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Submitted</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {submittedParticipants.length === 0 ? <li>None yet</li> : null}
                {submittedParticipants.map((participant) => (
                  <li key={participant.id}>{participant.name}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Pending</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {pendingParticipants.length === 0 ? <li>None</li> : null}
                {pendingParticipants.map((participant) => (
                  <li key={participant.id}>{participant.name}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {session.status === "results" ? (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => setShowRankingResults((previous) => !previous)}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {showRankingResults ? "Hide Ranking Results" : "Show Ranking Results"}
            </button>

            {showRankingResults ? (
              <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Results</h2>

            {comparisonNote ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{comparisonNote}</p>
            ) : null}

            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Deferred Acceptance Results
                </h3>

                {deferredAcceptanceResult?.errorMessage ? (
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {deferredAcceptanceResult.errorMessage}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Matched: {deferredAcceptanceResult?.matches.length ?? 0}
                    </p>
                    {Math.max(sideACount - (deferredAcceptanceResult?.matches.length ?? 0), 0) > 0 ? (
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        Unmatched: {Math.max(sideACount - (deferredAcceptanceResult?.matches.length ?? 0), 0)}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {deferredAcceptanceResult?.matches.length ? null : <li>No matches available yet.</li>}
                      {deferredAcceptanceResult?.matches.map((match) => (
                        <li key={`${match.sideAId}-${match.sideBId}`}>
                          {match.sideAName} ↔ {match.sideBName}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Immediate Acceptance Results
                </h3>

                {immediateAcceptanceResult?.errorMessage ? (
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {immediateAcceptanceResult.errorMessage}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Matched: {immediateAcceptanceResult?.matches.length ?? 0}
                    </p>
                    {Math.max(sideACount - (immediateAcceptanceResult?.matches.length ?? 0), 0) > 0 ? (
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        Unmatched: {Math.max(sideACount - (immediateAcceptanceResult?.matches.length ?? 0), 0)}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {immediateAcceptanceResult?.matches.length ? null : <li>No matches available yet.</li>}
                      {immediateAcceptanceResult?.matches.map((match) => (
                        <li key={`${match.sideAId}-${match.sideBId}`}>
                          {match.sideAName} ↔ {match.sideBName}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Top Trading Cycles Results
                </h3>

                {topTradingCyclesResult?.errorMessage ? (
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {topTradingCyclesResult.errorMessage}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Matched: {topTradingCyclesResult?.matches.length ?? 0}
                    </p>
                    {Math.max(sideACount - (topTradingCyclesResult?.matches.length ?? 0), 0) > 0 ? (
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        Unmatched: {Math.max(sideACount - (topTradingCyclesResult?.matches.length ?? 0), 0)}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {topTradingCyclesResult?.matches.length ? null : <li>No matches available yet.</li>}
                      {topTradingCyclesResult?.matches.map((match) => (
                        <li key={`${match.sideAId}-${match.sideBId}`}>
                          {match.sideAName} ↔ {match.sideBName}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
