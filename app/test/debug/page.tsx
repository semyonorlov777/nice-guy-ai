"use client";

import { useState, useEffect } from "react";
import type { TestQuestion } from "@/lib/test-config";

interface DebugQuestion {
  text: string;
  scale: string;
  type: string;
  scaleName: string;
}

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

const BATCH_SIZE = 5; // параллельных запросов за раз

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

const shortModel = (m: string) => m.replace("gemini-", "").replace("2.5-", "");

export default function TestDebugPage() {
  const [questions, setQuestions] = useState<DebugQuestion[]>([]);
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
  // "Все вопросы" state
  const [runningAll, setRunningAll] = useState(false);
  const [allProgress, setAllProgress] = useState({ done: 0, total: 0 });
  const [allResults, setAllResults] = useState<DebugResult[] | null>(null);

  // Load questions from test config API
  useEffect(() => {
    fetch("/api/test/config")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.questions && data?.scaleNames) {
          setQuestions(
            (data.questions as TestQuestion[]).map((q: TestQuestion) => ({
              text: q.text,
              scale: q.scale,
              type: q.type,
              scaleName: data.scaleNames[q.scale] || q.scale,
            }))
          );
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  if (!DEBUG_ENABLED) {
    return (
      <div style={{ padding: 40, color: "#888", fontFamily: "sans-serif" }}>
        Дебаг-страница отключена. Установите NEXT_PUBLIC_DEBUG_ENABLED=true.
      </div>
    );
  }

  const questionsLoaded = questions.length > 0;
  const question = questions[questionIndex];
  const scaleName = question?.scaleName || "";

  async function sendRequestForQ(qi: number, pt: PromptType, mt: ModelType, text: string): Promise<DebugResult> {
    const res = await fetch("/api/test/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer_text: text,
        question_index: qi,
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

  function sendRequest(pt: PromptType, mt: ModelType): Promise<DebugResult> {
    return sendRequestForQ(questionIndex, pt, mt, answerText.trim());
  }

  function makeErrorResult(qi: number, pt: PromptType, mt: ModelType, text: string, errMsg: string): DebugResult {
    const q = questions[qi];
    return {
      question_index: qi,
      question_text: q?.text ?? `Q${qi + 1}`,
      scale_name: q?.scaleName ?? "",
      answer_text: text,
      prompt_type: pt,
      model: mt,
      full_prompt: "",
      raw_response: `Ошибка: ${errMsg}`,
      parsed_score: null,
      parse_success: false,
      response_time_ms: 0,
      tokens_used: null,
    };
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
        ALL_COMBOS.map((c) => sendRequest(c.prompt_type, c.model).catch((err) =>
          makeErrorResult(questionIndex, c.prompt_type, c.model, answerText.trim(), (err as Error).message)
        ))
      );
      setCompareResults(results);
      setHistory((prev) => [...results, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setComparing(false);
    }
  }

  async function handleRunAllQuestions() {
    const text = answerText.trim();
    if (!text || runningAll) return;
    setRunningAll(true);
    setError(null);
    setAllResults(null);

    const tasks: { qi: number; pt: PromptType; mt: ModelType }[] = [];
    for (let qi = 0; qi < questions.length; qi++) {
      for (const c of ALL_COMBOS) {
        tasks.push({ qi, pt: c.prompt_type, mt: c.model });
      }
    }

    const total = tasks.length;
    setAllProgress({ done: 0, total });
    const results: DebugResult[] = [];

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((t) =>
          sendRequestForQ(t.qi, t.pt, t.mt, text).catch((err) =>
            makeErrorResult(t.qi, t.pt, t.mt, text, (err as Error).message)
          )
        )
      );
      results.push(...batchResults);
      setAllProgress({ done: results.length, total });
    }

    setAllResults(results);
    setRunningAll(false);
  }

  const configLabel = (r: DebugResult) =>
    `${PROMPT_LABELS[r.prompt_type] || r.prompt_type} + ${shortModel(r.model)}`;

  return (
    <div style={{
      maxWidth: 1100,
      margin: "0 auto",
      padding: "32px 16px",
      fontFamily: "'Onest', system-ui, sans-serif",
      color: "#e0e0e0",
      background: "#0f1114",
      minHeight: "100dvh",
    }}>
      <h1 style={{ fontSize: 20, marginBottom: 24, color: "#c9a84c" }}>
        Тест — Дебаг промптов
      </h1>

      {!questionsLoaded && (
        <div style={{ padding: "12px 16px", background: "#16181d", borderRadius: 8, marginBottom: 16, fontSize: 14, color: "#888" }}>
          Загрузка вопросов…
        </div>
      )}

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
          {questions.map((q, i) => (
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
          rows={5}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "#1a1d22",
            color: "#e0e0e0",
            border: "1px solid #333",
            borderRadius: 8,
            fontSize: 15,
            lineHeight: 1.5,
            resize: "vertical",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={handleSubmit}
          disabled={loading || !answerText.trim() || !questionsLoaded}
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
          disabled={comparing || !answerText.trim() || !questionsLoaded}
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
        <button
          onClick={handleRunAllQuestions}
          disabled={runningAll || !answerText.trim() || !questionsLoaded}
          style={{
            padding: "10px 24px",
            background: runningAll ? "#333" : "#1a1d22",
            color: runningAll ? "#888" : "#e0e0e0",
            border: "1px solid #555",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: runningAll ? "not-allowed" : "pointer",
          }}
        >
          {runningAll
            ? `Все вопросы... ${allProgress.done}/${allProgress.total}`
            : `Все вопросы (${questions.length}x4)`}
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
              padding: "10px 14px",
              background: "#0f1114",
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
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
                    <td style={{ padding: "6px", fontSize: 12 }}>{shortModel(r.model)}</td>
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
                      maxWidth: 400,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: 12,
                      lineHeight: 1.4,
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

      {/* All questions results */}
      {allResults && (
        <div style={{
          background: "#16181d",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, color: "#c9a84c", margin: 0 }}>
              Все вопросы — {allResults.length} результатов
            </h3>
            <button
              onClick={() => setAllResults(null)}
              style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}
            >
              Скрыть
            </button>
          </div>

          {/* Summary: success rate per combo */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {ALL_COMBOS.map((c) => {
              const comboResults = allResults.filter(
                (r) => r.prompt_type === c.prompt_type && r.model.includes(c.model === "flash-lite" ? "flash-lite" : "flash") && !r.model.includes("lite") === (c.model === "flash")
              );
              // Simpler filter
              const filtered = allResults.filter((r) => {
                const isLite = r.model.includes("lite");
                return r.prompt_type === c.prompt_type && (c.model === "flash-lite" ? isLite : !isLite);
              });
              const success = filtered.filter((r) => r.parse_success).length;
              const total = filtered.length;
              const avgTime = total > 0 ? Math.round(filtered.reduce((s, r) => s + r.response_time_ms, 0) / total) : 0;
              return (
                <div key={`${c.prompt_type}-${c.model}`} style={{
                  padding: "8px 14px",
                  background: "#0f1114",
                  borderRadius: 8,
                  fontSize: 13,
                }}>
                  <div style={{ color: "#c9a84c", fontWeight: 600, marginBottom: 4 }}>
                    {PROMPT_LABELS[c.prompt_type]} + {MODEL_LABELS[c.model]}
                  </div>
                  <div>
                    <span style={{ color: success === total ? "#4ade80" : "#ff6b6b" }}>
                      {success}/{total} распознано
                    </span>
                    <span style={{ color: "#888", marginLeft: 12 }}>~{avgTime}ms</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full table */}
          <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "#16181d" }}>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th style={{ textAlign: "left", padding: "6px 4px", color: "#888" }}>Q#</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", color: "#888" }}>Шкала</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", color: "#888" }}>Промпт</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", color: "#888" }}>Модель</th>
                  <th style={{ textAlign: "center", padding: "6px 4px", color: "#888" }}>Балл</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", color: "#888" }}>ms</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", color: "#888" }}>Ответ AI</th>
                </tr>
              </thead>
              <tbody>
                {allResults.map((r, i) => (
                  <tr key={i} style={{
                    borderBottom: "1px solid #222",
                    background: i % 8 < 4 ? "transparent" : "#1a1d22",
                  }}>
                    <td style={{ padding: "5px 4px" }}>{r.question_index + 1}</td>
                    <td style={{ padding: "5px 4px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.scale_name}
                    </td>
                    <td style={{ padding: "5px 4px" }}>{PROMPT_LABELS[r.prompt_type]}</td>
                    <td style={{ padding: "5px 4px" }}>{shortModel(r.model)}</td>
                    <td style={{
                      padding: "5px 4px",
                      textAlign: "center",
                      color: r.parse_success ? "#4ade80" : "#ff6b6b",
                      fontWeight: 600,
                    }}>
                      {r.parsed_score ?? "—"}
                    </td>
                    <td style={{ padding: "5px 4px", textAlign: "right", color: "#888" }}>
                      {r.response_time_ms}
                    </td>
                    <td style={{
                      padding: "5px 4px",
                      maxWidth: 350,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.3,
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
                      {shortModel(h.model)}
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
                    <td style={{
                      padding: "6px 4px",
                      maxWidth: 250,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: 12,
                      lineHeight: 1.3,
                    }}>
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
