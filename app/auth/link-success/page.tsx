"use client";

export default function LinkSuccessPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1114",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        padding: "80px 16px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "36px 28px",
          background: "#16181d",
          borderRadius: 16,
          border: "1px solid #2a2d35",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 600,
            color: "#c9a84c",
            marginBottom: 12,
          }}
        >
          Вы успешно вошли
        </h1>
        <p style={{ fontSize: 15, color: "#999", lineHeight: 1.6, marginBottom: 24 }}>
          Вернитесь на вкладку с тестом.
          <br />
          Эту вкладку можно закрыть.
        </p>
        <button
          onClick={() => window.close()}
          style={{
            padding: "12px 32px",
            borderRadius: 10,
            border: "none",
            background: "#c9a84c",
            color: "#0f1114",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Закрыть вкладку
        </button>
      </div>
    </div>
  );
}
