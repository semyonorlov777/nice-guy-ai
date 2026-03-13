"use client";

import { useState } from "react";
import { ISSP_QUESTIONS, ISSP_SCALE_NAMES } from "@/lib/issp-config";

interface DebugResult {
  question_index: number;
  question_text: string;
  scale_name: string;
  answer_text: string;
  prompt_type: "mini" | "full";
  model: string;
  full_prompt: string;
  raw_response: string;
  parsed_score: number | null;
  parse_success: boolean;
  response_time_ms: number;
  tokens_used: number | null;
}

type PromptType = "mini" | "full";
type ModelType = "flash" | "flash-lite";

const PROMPT_LABELS: Record<PromptType, string> = { mini: "Mini", full: "Full" };
const MODEL_LABELS: Record<ModelType, string> = { flash: "Flash", "flash-lite": "Flash Lite" };

const ALL_COMBOS: { prompt_type: PromptType; model: ModelType }[] = [
  { prompt_type: "mini", model: "flash" },
  { prompt_type: "mini", model: "flash-lite" },
  { prompt_type: "full", model: "flash" },
  { prompt_type: "full", model: "flash-lite" },
];

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG_ENABLED === "true";

const toggleStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  background: active ? "#c9a84c" : "#1a1d22",
  color: active ? "#0f1114" : "#888",
  border: active ? "1px solid #c9a84c" : "1px solid #333",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  cursor: "pointer",
});

export default function TestDebugPage() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [promptType, setPromptType] = useState<PromptType>("mini");
  const [modelType, setModelType] = useState<ModelType>("flash");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DebugResult[]>([]);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState<DebugResult[] | null>(null);

  if (!DEBUG_ENABLED) {
    return (
      <div style={{ padding: 40, color: "#888", fontFamily: "sans-serif" }}>
        Дебаг-страница отключена. Установите NEXT_PUBLIC_DEBUG_ENABLED=true.
      </div>
    );
  }

  const question = ISSP_QUESTIONS[questionIndex];
  const scaleName = ISSP_SCALE_NAMES[question?.scale] || "";

  async function sendRequest(pt: PromptType, mt: ModelType): Promise<DebugResult> {
    const res = await fetch("/api/test/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer_text: answerText.trim(),
        question_index: questionIndex,
        prompt_type: pt,
        model: mt,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `Ошибка: ${res.status}`);
    }

    return res.json();
  }

  async function handleSubmit() {
    if (!answerText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await sendRequest(promptType, modelType);
      setResult(data);
      setHistory((prev) => [data, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompareAll() {
    if (!answerText.trim() || comparing) return;
    setComparing(true);
    setError(null);
    setCompareResults(null);

    try {
      const results = await Promise.all(
        ALL_COMBOS.map((c) => sendRequest(c.prompt_type, c.model).catch((err) => ({
          question_index: questionIndex,
          question_text: question.text,
          scale_name: scaleName,
          answer_text: answerText.trim(),
          prompt_type: c.prompt_type,
          model: c.model,
          full_prompt: "",
          raw_response: `Ошибка: ${(err as Error).message}`,
          parsed_score: null,
          parse_success: false,
          response_time_ms: 0,
          tokens_used: null,
        } as DebugResult)))
      );
      setCompareResults(results);
      setHistory((prev) => [...results, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setComparing(false);
    }
  }

  const configLabel = (r: DebugResult) =>
    `${PROMPT_LABELS[r.prompt_type] || r.prompt_type} + ${r.model.replace("gemini-", "").replace("2.5-", "").replace("2.0-", "")}`;

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "32px 16px",
      fontFamily: "'Onest', system-ui, sans-serif",
      color: "#e0e0e0",
      background: "#0f1114",
      minHeight: "100vh",
    }}>
      <h1 style={{ fontSize: 20, marginBottom: 24, color: "#c9a84c" }}>
        ИССП — Дебаг промптов
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

      {/* Prompt & Model toggles */}
      <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Промпт:</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["mini", "full"] as PromptType[]).map((pt) => (
              <button key={pt} onClick={() => setPromptType(pt)} style={toggleStyle(promptType === pt)}>
                {PROMPT_LABELS[pt]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Модель:</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["flash", "flash-lite"] as ModelType[]).map((mt) => (
              <button key={mt} onClick={() => setModelType(mt)} style={toggleStyle(modelType === mt)}>
                {MODEL_LABELS[mt]}
              </button>
            ))}
          </div>
        </div>
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

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
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
          }}
        >
          {loading ? "Отправляю..." : "Отправить"}
        </button>
        <button
          onClick={handleCompareAll}
          disabled={comparing || !answerText.trim()}
          style={{
            padding: "10px 24px",
            background: comparing ? "#333" : "#1a1d22",
            color: comparing ? "#888" : "#c9a84c",
            border: "1px solid #c9a84c",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: comparing ? "not-allowed" : "pointer",
          }}
        >
          {comparing ? "Сравниваю..." : "Сравнить все (4)"}
        </button>
      </div>

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

      {/* Single result */}
      {result && (
        <div style={{
          background: "#16181d",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, color: "#c9a84c" }}>
            Результат — {configLabel(result)}
          </h3>

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
                maxHeight: 400,
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

          {/* Metrics */}
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

      {/* Compare results */}
      {compareResults && (
        <div style={{
          background: "#16181d",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, color: "#c9a84c" }}>
            Сравнение — 4 комбинации
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "#888" }}>Промпт</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "#888" }}>Модель</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", color: "#888" }}>Балл</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: "#888" }}>ms</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: "#888" }}>Токены</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "#888" }}>Ответ AI</th>
                </tr>
              </thead>
              <tbody>
                {compareResults.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "6px" }}>{PROMPT_LABELS[r.prompt_type] || r.prompt_type}</td>
                    <td style={{ padding: "6px", fontSize: 12 }}>{r.model}</td>
                    <td style={{
                      padding: "6px",
                      textAlign: "center",
                      color: r.parse_success ? "#4ade80" : "#ff6b6b",
                      fontWeight: 600,
                    }}>
                      {r.parsed_score ?? "—"}
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", color: "#888" }}>
                      {r.response_time_ms}
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", color: "#888" }}>
                      {r.tokens_used ?? "—"}
                    </td>
                    <td style={{
                      padding: "6px",
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {r.raw_response}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: "#888" }}>
            История ({history.length})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Q</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Ответ</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Промпт</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Модель</th>
                  <th style={{ textAlign: "center", padding: "8px 4px", color: "#888" }}>Балл</th>
                  <th style={{ textAlign: "right", padding: "8px 4px", color: "#888" }}>ms</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#888" }}>Ответ AI</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "6px 4px" }}>{h.question_index + 1}</td>
                    <td style={{ padding: "6px 4px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.answer_text}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{PROMPT_LABELS[h.prompt_type] || h.prompt_type}</td>
                    <td style={{ padding: "6px 4px", fontSize: 12 }}>
                      {h.model.replace("gemini-", "").replace("2.5-", "").replace("2.0-", "")}
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
                    <td style={{ padding: "6px 4px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.raw_response}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
