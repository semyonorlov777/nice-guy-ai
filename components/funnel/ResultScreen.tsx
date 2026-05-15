"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { AnalyzingScreen } from "./AnalyzingScreen";
import { loadSession, saveSession } from "@/lib/funnel/session";
import type { AnalyzeResponse, FunnelSession } from "@/lib/funnel/types";

const MIN_ANALYZE_TIME_MS = 70_000;

type Phase = "loading" | "analyzing" | "ready" | "error";

export function ResultScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<FunnelSession | null>(null);
  const [responseReady, setResponseReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyzeStartRef = useRef<number>(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const existing = loadSession();
    if (!existing) {
      router.replace("/funnel");
      return;
    }
    if (existing.answers.length < 5) {
      router.replace("/funnel/test");
      return;
    }

    if (existing.result && existing.status === "ready") {
      setSession(existing);
      setPhase("ready");
      return;
    }

    setSession(existing);
    setPhase("analyzing");
    analyzeStartRef.current = Date.now();

    if (startedRef.current) return;
    startedRef.current = true;

    void runAnalyze(existing)
      .then((result) => {
        const updated: FunnelSession = {
          ...existing,
          result,
          status: "ready",
        };
        saveSession(updated);
        setSession(updated);
        setResponseReady(true);
      })
      .catch((err) => {
        console.error("[ResultScreen] analyze failed:", err);
        setError("Не получилось собрать разбор. Попробуйте ещё раз.");
        setPhase("error");
      });
  }, [router]);

  useEffect(() => {
    if (!responseReady) return;
    const elapsed = Date.now() - analyzeStartRef.current;
    const remaining = Math.max(MIN_ANALYZE_TIME_MS - elapsed, 0);
    const t = setTimeout(() => setPhase("ready"), remaining);
    return () => clearTimeout(t);
  }, [responseReady]);

  if (phase === "loading") {
    return (
      <div className="funnel-screen funnel-loading-screen">
        <div className="funnel-loading-spinner" />
      </div>
    );
  }

  if (phase === "analyzing") {
    return <AnalyzingScreen ready={responseReady} />;
  }

  if (phase === "error") {
    return (
      <div className="funnel-screen funnel-loading-screen">
        <p className="funnel-error-text">{error}</p>
        <button
          className="funnel-btn-primary"
          onClick={() => window.location.reload()}
        >
          Попробовать ещё
        </button>
      </div>
    );
  }

  if (!session?.result) {
    return (
      <div className="funnel-screen funnel-loading-screen">
        <p className="funnel-loading-text">Минутку…</p>
      </div>
    );
  }

  return (
    <div className="funnel-screen funnel-result">
      <div className="funnel-result-hero">
        <div className="funnel-result-eyebrow">Ваш персональный разбор</div>
        <h1 className="funnel-result-title">То, что мы услышали в ваших ответах</h1>
      </div>

      <article className="funnel-result-body">
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>
          {session.result}
        </ReactMarkdown>
      </article>

      <div className="funnel-result-footer">
        <button
          className="funnel-btn-primary funnel-btn-large"
          onClick={() => router.push("/funnel/offer")}
        >
          Что с этим делать дальше →
        </button>
      </div>
    </div>
  );
}

async function runAnalyze(session: FunnelSession): Promise<string> {
  const response = await fetch("/api/funnel/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: session.answers }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as AnalyzeResponse;
  if (!data.result) {
    throw new Error("Empty result");
  }
  return data.result;
}
