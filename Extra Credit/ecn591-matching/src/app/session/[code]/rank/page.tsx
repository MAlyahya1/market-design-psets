"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SessionRecord = {
  id: string;
  code: string;
  status: string;
};

type ParticipantRecord = {
  id: string;
  name: string;
  side: "A" | "B";
};

export default function RankingPage() {
  const params = useParams<{ code: string }>();
  const sessionCode = (params.code ?? "").toUpperCase();

  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [session, setSession] = useState<SessionRecord | null>(null);
  const [participant, setParticipant] = useState<ParticipantRecord | null>(null);
  const [opponents, setOpponents] = useState<ParticipantRecord[]>([]);
  const [rankSelections, setRankSelections] = useState<string[]>([]);

  const canRank = useMemo(
    () => Boolean(session && participant && session.status === "ranking" && opponents.length > 0),
    [session, participant, opponents.length],
  );

  async function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setSession(null);
    setParticipant(null);
    setOpponents([]);
    setRankSelections([]);

    const { data: foundSession, error: sessionError } = await supabase
      .from("sessions")
      .select("id, code, status")
      .eq("code", sessionCode)
      .maybeSingle();

    if (sessionError || !foundSession) {
      setErrorMessage("Session does not exist. Check the code and try again.");
      setIsLoading(false);
      return;
    }

    setSession(foundSession);

    if (foundSession.status !== "ranking") {
      setInfoMessage("Rankings are not open yet.");
      setIsLoading(false);
      return;
    }

    const { data: foundParticipant, error: participantError } = await supabase
      .from("participants")
      .select("id, name, side")
      .eq("session_id", foundSession.id)
      .eq("name", trimmedName)
      .maybeSingle();

    if (participantError || !foundParticipant) {
      setErrorMessage("Participant not found in this session. Please check your name.");
      setIsLoading(false);
      return;
    }

    setParticipant(foundParticipant as ParticipantRecord);

    const { data: foundOpponents, error: opponentsError } = await supabase
      .from("participants")
      .select("id, name, side")
      .eq("session_id", foundSession.id)
      .neq("side", foundParticipant.side)
      .order("created_at", { ascending: true });

    if (opponentsError) {
      setErrorMessage("Could not load ranking options. Please try again.");
      setIsLoading(false);
      return;
    }

    const opponentRows = (foundOpponents ?? []) as ParticipantRecord[];
    setOpponents(opponentRows);
    setRankSelections(Array.from({ length: opponentRows.length }, () => ""));
    setIsLoading(false);
  }

  function updateRank(position: number, participantId: string) {
    setRankSelections((prev) => {
      const next = [...prev];
      next[position] = participantId;
      return next;
    });
  }

  async function handleSubmitRanking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !participant) {
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    const hasMissing = rankSelections.some((value) => !value);
    if (hasMissing) {
      setErrorMessage("Please fill every rank position before submitting.");
      return;
    }

    const uniqueSelections = new Set(rankSelections);
    if (uniqueSelections.size !== rankSelections.length) {
      setErrorMessage("Each participant can only be ranked once.");
      return;
    }

    setIsSubmitting(true);

    const { data: existingPreference, error: existingPreferenceError } = await supabase
      .from("preferences")
      .select("id")
      .eq("session_id", session.id)
      .eq("participant_id", participant.id)
      .maybeSingle();

    if (existingPreferenceError) {
      setErrorMessage("Could not save ranking. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (existingPreference) {
      const { error: updateError } = await supabase
        .from("preferences")
        .update({ ranked_participant_ids: rankSelections, submitted_at: new Date().toISOString() })
        .eq("id", existingPreference.id);

      if (updateError) {
        setErrorMessage("Could not save ranking. Please try again.");
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("preferences").insert({
        session_id: session.id,
        participant_id: participant.id,
        ranked_participant_ids: rankSelections,
      });

      if (insertError) {
        setErrorMessage("Could not save ranking. Please try again.");
        setIsSubmitting(false);
        return;
      }
    }

    const { count: participantCount } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    const { data: submittedRows, error: submittedRowsError } = await supabase
      .from("preferences")
      .select("participant_id")
      .eq("session_id", session.id);

    if (!submittedRowsError) {
      const uniqueSubmittedCount = new Set(
        (submittedRows ?? []).map((row) => row.participant_id),
      ).size;

      if (participantCount && uniqueSubmittedCount >= participantCount) {
        await supabase
          .from("sessions")
          .update({ status: "results" })
          .eq("id", session.id)
          .eq("status", "ranking");

        setSession((previous) =>
          previous
            ? {
                ...previous,
                status: "results",
              }
            : previous,
        );
      }
    }

    setInfoMessage("Ranking submitted.");
    setIsSubmitting(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          Ranking
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Session code: {sessionCode}</p>

        <form onSubmit={handleLoad} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="participant-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Your name
            </label>
            <input
              id="participant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isLoading ? "Checking..." : "Start Ranking"}
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}

        {infoMessage ? (
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{infoMessage}</p>
        ) : null}

        {canRank ? (
          <form onSubmit={handleSubmitRanking} className="mt-6 space-y-4">
            {opponents.map((opponent, index) => (
              <div key={opponent.id} className="space-y-2">
                <label
                  htmlFor={`rank-${index + 1}`}
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Rank {index + 1}
                </label>
                <select
                  id={`rank-${index + 1}`}
                  value={rankSelections[index] ?? ""}
                  onChange={(event) => updateRank(index, event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  required
                >
                  <option value="">Select participant</option>
                  {opponents.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isSubmitting ? "Saving..." : "Submit Ranking"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
