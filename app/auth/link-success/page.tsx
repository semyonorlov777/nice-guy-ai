"use client";

export default function LinkSuccessPage() {
  return (
    <div className="auth-success-page">
      <div className="auth-success-card">
        <div className="auth-success-icon">&#10003;</div>
        <h1 className="auth-success-title">Вы успешно вошли</h1>
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
