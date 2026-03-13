"use client";

import { useState } from "react";
import { ISSP_QUESTIONS, ISSP_SCALE_NAMES } from "@/lib/issp-config";

interface DebugResult {
  question_index: number;
  question_text: string;
  scale_name: string;
  answer_text: string;
  full_prompt: string;
  raw_response: string;
  parsed_score: number | null;
  parse_success: boolean;
  response_time_ms: number;
  tokens_used: number | null;
  model: string;
}

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG_ENABLED === "true";

export default function TestDebugPage() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DebugResult[]>([]);
  const [promptExpanded, setPromptExpanded] = useState(false);

  if (!DEBUG_ENABLED) {
    return (
      <div style={{ padding: 40, color: "#888", fontFamily: "sans-serif" }}>
        Дебаг-страница отключена. Установите NEXT_PUBLIC_DEBUG_ENABLED=true.
      </div>
    );
  }

  const question = ISSP_QUESTIONS[questionIndex];
  const scaleName = ISSP_SCALE_NAMES[question?.scale] || "";

  async function handleSubmit() {
    if (!answerText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/test/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_text: answerText.trim(), question_index: questionIndex }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Ошибка: ${res.status}`);
      }

      const data: DebugResult = await res.json();
      setResult(data);
      setHistory((prev) => [data, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      maxWidth: 720,
      margin: "0 auto",
      padding: "32px 16px",
      fontFamily: "'Onest', system-ui, sans-serif",
      color: "#e0e0e0",
      background: "#0f1114",
      minHeight: "100vh",
    }}>
      <h1 style={{ fontSize: 20, marginBottom: 24, color: "#c9a84c" }}>
        ИССП — Дебаг мини-промпта
      </h1>

      {/* Question selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 4 }}>
          Вопрос:
        </label>
        <select
          value={questionIndex}
          onChange={(e) => setQuestionIndex(Number(e.target.value))}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "#1a1d22",
            color: "#e0e0e0",
            border: "1px solid #333",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {ISSP_QUESTIONS.map((q, i) => (
            <option key={i} value={i}>
              {i + 1}. {q.text.slice(0, 60)}...
            </option>
          ))}
        </select>
      </div>

      {/* Question info */}
      <div style={{
        padding: "12px 16px",
        background: "#16181d",
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 14,
        lineHeight: 1.5,
      }}>
        <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>
          Шкала: {scaleName} | Тип: {question?.type}
        </div>
        {question?.text}
      </div>

      {/* Answer input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 4 }}>
          Ответ пользователя:
        </label>
        <textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder="ну типа да, бывает..."
          rows={3}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "#1a1d22",
            color: "#e0e0e0",
            border: "1px solid #333",
            borderRadius: 8,
            fontSize: 14,
            resize: "vertical",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !answerText.trim()}
        style={{
          padding: "10px 24px",
          background: loading ? "#333" : "#c9a84c",
          color: loading ? "#888" : "#0f1114",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: 24,
        }}
      >
        {loading ? "Отправляю..." : "Отправить"}
      </button>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px",
          background: "#2d1a1a",
          color: "#ff6b6b",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          background: "#16181d",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, color: "#c9a84c" }}>Результат</h3>

          {/* Prompt (collapsible) */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setPromptExpanded(!promptExpanded)}
              style={{
                background: "none",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: 13,
                padding: 0,
              }}
            >
              {promptExpanded ? "▼" : "▶"} Промпт
            </button>
            {promptExpanded && (
              <pre style={{
                background: "#0f1114",
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
                marginTop: 8,
                whiteSpace: "pre-wrap",
                color: "#aaa",
              }}>
                {result.full_prompt}
              </pre>
            )}
          </div>

          {/* AI response */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Ответ AI:</div>
            <div style={{
              padding: "8px 12px",
              background: "#0f1114",
              borderRadius: 8,
              fontSize: 14,
            }}>
              {result.raw_response}
            </div>
          </div>

          {/* Parsed score */}
          <div style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            fontSize: 14,
          }}>
            <div>
              <span style={{ color: "#888" }}>Число: </span>
              <span style={{ color: result.parse_success ? "#4ade80" : "#ff6b6b", fontWeight: 600 }}>
                {result.parsed_score !== null ? result.parsed_score : "—"}{" "}
                {result.parse_success ? "✓" : "✗"}
              </span>
            </div>
            <div>
              <span style={{ color: "#888" }}>Время: </span>
              <span>{result.response_time_ms}ms</span>
            </div>
            <div>
              <span style={{ color: "#888" }}>Модель: </span>
              <span>{result.model}</span>
            </div>
            {result.tokens_used !== null && (
              <div>
                <span style={{ color: "#888" }}>Токены: </span>
                <span>{result.tokens_used}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: "#888" }}>
            История ({history.length})
          </h3>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Q</th>
                <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Ответ</th>
                <th style={{ textAlign: "center", padding: "8px 4px", color: "#888" }}>Балл</th>
                <th style={{ textAlign: "right", padding: "8px 4px", color: "#888" }}>ms</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "6px 4px" }}>{h.question_index + 1}</td>
                  <td style={{ padding: "6px 4px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.answer_text}
                  </td>
                  <td style={{
                    padding: "6px 4px",
                    textAlign: "center",
                    color: h.parse_success ? "#4ade80" : "#ff6b6b",
                  }}>
                    {h.parsed_score ?? "—"}
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "right", color: "#888" }}>
                    {h.response_time_ms}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
