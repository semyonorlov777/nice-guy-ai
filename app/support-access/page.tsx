"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export default function SupportAccessPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Неверный email или пароль");
      setLoading(false);
      return;
    }

    router.push(`/program/${DEFAULT_PROGRAM_SLUG}/balance`);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f1114",
      fontFamily: "var(--font-onest), sans-serif",
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#16181d",
          borderRadius: 12,
          padding: 32,
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h1 style={{ color: "#fff", fontSize: 20, margin: 0, textAlign: "center" }}>
          Служебный вход
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #2a2d35",
            background: "#0f1114",
            color: "#fff",
            fontSize: 14,
            outline: "none",
          }}
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #2a2d35",
            background: "#0f1114",
            color: "#fff",
            fontSize: 14,
            outline: "none",
          }}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: 13, margin: 0, textAlign: "center" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: loading ? "#555" : "#c9a84c",
            color: "#0f1114",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
