import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import type { CardPhase, DebugLogEntry } from "./types";
import type { MutableRefObject } from "react";

interface UseResultPollingParams {
  phase: CardPhase;
  resultId: string | null;
  chatId: string | null;
  isDebug: boolean;
  debugLogRef: MutableRefObject<DebugLogEntry[]>;
  setPhase: (phase: CardPhase) => void;
  setResultId: (id: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
}

export function useResultPolling({
  phase,
  resultId,
  chatId,
  isDebug,
  debugLogRef,
  setPhase,
  setResultId,
  setErrorMessage,
}: UseResultPollingParams) {
  const router = useRouter();
  const pathname = usePathname();
  const programSlug = pathname.match(/^\/program\/([^/]+)\//)?.[1] ?? DEFAULT_PROGRAM_SLUG;

  // Debug summary when entering analyzing phase
  useEffect(() => {
    if (phase !== "analyzing" || !isDebug || debugLogRef.current.length === 0) return;
    console.log("[TEST DEBUG] === ИТОГО ===");
    console.table(debugLogRef.current.map(entry => ({
      "Вопрос": `Q${entry.question}`,
      "Отправлено": entry.sentScore,
      "Сервер": entry.serverConfirmed ? "\u2713" : "\u2717",
      "Следующий Q": entry.serverQuestion,
    })));
    console.log(`[TEST DEBUG] Всего ответов отправлено: ${debugLogRef.current.length}`);
  }, [phase, isDebug]);

  // Polling for resultId during analyzing phase
  useEffect(() => {
    if (phase !== "analyzing" || resultId) return;

    let cancelled = false;
    let intervalRef: ReturnType<typeof setInterval> | undefined;
    let notFoundCount = 0;
    let processingCount = 0;
    let waitingForChatId = 0;
    const NOT_FOUND_LIMIT = 20;
    const PROCESSING_LIMIT = 20;
    const CHAT_ID_WAIT_LIMIT = 10;

    const poll = async () => {
      if (!chatId) {
        waitingForChatId++;
        if (waitingForChatId >= CHAT_ID_WAIT_LIMIT && !cancelled) {
          console.error("[Test] chatId still null after", CHAT_ID_WAIT_LIMIT, "polls — cannot fetch results");
          setPhase("question");
          setErrorMessage("Не удалось получить результаты. Попробуйте ответить на последний вопрос ещё раз.");
          setTimeout(() => setErrorMessage(null), 8000);
        }
        return;
      }

      try {
        const res = await fetch(`/api/test/result?chat_id=${chatId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        console.log("[Test] polling response:", data.status, data.result_id);

        if (data.result_id && data.status === "ready" && !cancelled) {
          setResultId(data.result_id);
          return;
        }

        if (data.result_id && data.status === "processing") {
          processingCount++;
          if (processingCount >= PROCESSING_LIMIT && !cancelled) {
            console.warn("[Test] accepting processing result after", processingCount, "polls, id:", data.result_id);
            setResultId(data.result_id);
            return;
          }
        }

        if (data.status === "not_found") {
          notFoundCount++;
          if (notFoundCount >= NOT_FOUND_LIMIT && !cancelled) {
            console.error("[Test] result not_found after", NOT_FOUND_LIMIT, "polls — INSERT likely failed");
            setPhase("question");
            setErrorMessage("Не удалось сохранить результаты. Попробуйте ответить на последний вопрос ещё раз.");
            setTimeout(() => setErrorMessage(null), 8000);
          }
        } else {
          notFoundCount = 0;
        }
      } catch {
        // ignore, retry next interval
      }
    };

    const firstTimeout = setTimeout(() => {
      if (cancelled) return;
      poll();
      intervalRef = setInterval(poll, 3000);
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(firstTimeout);
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [phase, resultId, chatId]);

  const handleResultReady = useCallback((newResultId: string) => {
    setResultId(newResultId);
    setPhase("complete");
  }, []);

  const handleViewResults = useCallback(() => {
    if (resultId) {
      router.push(`/program/${programSlug}/test/results/${resultId}`);
    }
  }, [resultId, router, programSlug]);

  return { handleResultReady, handleViewResults };
}
