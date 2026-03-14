"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: "#f2f0ed",
          color: "#1a1917",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "24px", marginBottom: "12px" }}>
            Что-то пошло не так
          </h2>
          <p style={{ color: "#6b6860", marginBottom: "24px" }}>
            Мы уже знаем об этой ошибке и работаем над ней
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              background: "#b8973a",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
