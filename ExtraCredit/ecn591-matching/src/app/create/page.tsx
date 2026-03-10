"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

function generateSessionCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";

  const letterPart = Array.from({ length: 3 }, () =>
    letters[Math.floor(Math.random() * letters.length)],
  ).join("");

  const numberPart = Array.from({ length: 3 }, () =>
    numbers[Math.floor(Math.random() * numbers.length)],
  ).join("");

  return `${letterPart}${numberPart}`;
}

export default function CreateSessionPage() {
  const [sessionTitle, setSessionTitle] = useState("");
  const [sizePerSide, setSizePerSide] = useState("5");
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shareableLink = useMemo(
    () => (sessionCode ? `/session/${sessionCode}` : ""),
    [sessionCode],
  );

  const joinLink = useMemo(() => (sessionCode ? `/join?code=${sessionCode}` : ""), [sessionCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSessionCode(null);
    setIsSubmitting(true);

    const code = generateSessionCode();
    const parsedSize = Number.parseInt(sizePerSide, 10);

    const { error } = await supabase.from("sessions").insert({
      code,
      title: sessionTitle.trim(),
      size_per_side: parsedSize,
      status: "lobby",
    });

    if (error) {
      setErrorMessage("Could not create session. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setSessionCode(code);
    setIsSubmitting(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          Create Session
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="session-title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Session title
            </label>
            <input
              id="session-title"
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
              placeholder="ECN 591 Demo Market"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="participants-per-side"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Number of participants per side
            </label>
            <input
              id="participants-per-side"
              type="number"
              min={1}
              value={sizePerSide}
              onChange={(event) => setSizePerSide(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSubmitting ? "Generating..." : "Generate Session"}
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}

        {sessionCode ? (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Session created successfully
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              This is your session code: <span className="font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">{sessionCode}</span>
            </p>
            <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">To join:</p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              Ask participants to enter their name, session code, and side using this link:
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href={joinLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                {joinLink}
              </Link>
            </p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">Then click "Join".</p>

            <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">Organizer session page:</p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              Use this link to view the session, participants, submission progress, and results:
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href={shareableLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                {shareableLink}
              </Link>
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
