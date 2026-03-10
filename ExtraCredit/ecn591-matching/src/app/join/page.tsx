"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [side, setSide] = useState<"A" | "B">("A");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const normalizedCode = sessionCode.trim().toUpperCase();
    if (!normalizedCode) {
      setIsSubmitting(false);
      return;
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, code, size_per_side, status")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (sessionError) {
      setErrorMessage("Could not find that session. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (!session) {
      setErrorMessage("Session does not exist. Check the code and try again.");
      setIsSubmitting(false);
      return;
    }

    if (session.status === "ranking") {
      setErrorMessage("This session is no longer accepting participants. Ranking has started.");
      setIsSubmitting(false);
      return;
    }

    if (session.status === "results") {
      setErrorMessage("This session is closed. Results are already available.");
      setIsSubmitting(false);
      return;
    }

    const { data: currentParticipants, error: currentParticipantsError } = await supabase
      .from("participants")
      .select("side")
      .eq("session_id", session.id);

    if (currentParticipantsError) {
      setErrorMessage("Could not check session capacity. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const sideACount = (currentParticipants ?? []).filter(
      (participant) => participant.side === "A",
    ).length;
    const sideBCount = (currentParticipants ?? []).filter(
      (participant) => participant.side === "B",
    ).length;

    const selectedSideCount = side === "A" ? sideACount : sideBCount;
    if (selectedSideCount >= session.size_per_side) {
      setErrorMessage(`Side ${side} is already full. Please choose the other side.`);
      setIsSubmitting(false);
      return;
    }

    const { error: participantError } = await supabase.from("participants").insert({
      session_id: session.id,
      name: name.trim(),
      side,
    });

    if (participantError) {
      setErrorMessage("Could not join session. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const { data: updatedParticipants, error: updatedParticipantsError } = await supabase
      .from("participants")
      .select("side")
      .eq("session_id", session.id);

    if (!updatedParticipantsError) {
      const updatedSideACount = (updatedParticipants ?? []).filter(
        (participant) => participant.side === "A",
      ).length;
      const updatedSideBCount = (updatedParticipants ?? []).filter(
        (participant) => participant.side === "B",
      ).length;

      if (
        updatedSideACount >= session.size_per_side &&
        updatedSideBCount >= session.size_per_side
      ) {
        await supabase
          .from("sessions")
          .update({ status: "ranking" })
          .eq("id", session.id)
          .eq("status", "lobby");
      }
    }

    setIsSubmitting(false);
    router.push(`/session/${normalizedCode}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          Join Session
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="session-code"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Session code
            </label>
            <input
              id="session-code"
              value={sessionCode}
              onChange={(event) => setSessionCode(event.target.value)}
              placeholder="ABC123"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase text-zinc-900 outline-none ring-zinc-400 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Side selection
            </legend>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="side"
                  value="A"
                  checked={side === "A"}
                  onChange={() => setSide("A")}
                />
                A
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="side"
                  value="B"
                  checked={side === "B"}
                  onChange={() => setSide("B")}
                />
                B
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSubmitting ? "Joining..." : "Join"}
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}
      </section>
    </main>
  );
}
