"use client";

import { useEffect, useState } from "react";

export default function PopupSuccessPage() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Send success message to opener (parent tab)
    try {
      window.opener?.postMessage(
        { type: "auth-success" },
        window.location.origin,
      );
    } catch {
      // cross-origin — ignore
    }

    // Try to close the popup window
    window.close();

    // If window.close() didn't work (mobile new tab), show fallback message
    const t = setTimeout(() => setShowFallback(true), 500);
    return () => clearTimeout(t);
  }, []);

  if (!showFallback) return null;

  return (
    <div className="auth-success-page">
      <div className="auth-success-card">
        <div className="auth-success-icon">&#10003;</div>
        <h1 className="auth-success-title">Авторизация успешна</h1>
        <p className="auth-success-text">
          Вернитесь на вкладку с тестом.
          <br />
          Эту вкладку можно закрыть.
        </p>
        <button onClick={() => window.close()} className="auth-success-btn">
          Закрыть вкладку
        </button>
      </div>
    </div>
  );
}
