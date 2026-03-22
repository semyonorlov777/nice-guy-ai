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
    <div className="support-page">
      <form onSubmit={handleSubmit} className="support-form">
        <h1 className="support-title">Служебный вход</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="support-input"
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="support-input"
        />

        {error && (
          <p className="support-error">{error}</p>
        )}

        <button type="submit" disabled={loading} className="support-btn">
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
