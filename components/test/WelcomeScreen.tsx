interface WelcomeScreenProps {
  onStart: () => void;
  isStarting: boolean;
}

export function WelcomeScreen({ onStart, isStarting }: WelcomeScreenProps) {
  return (
    <div className="tc-screen tc-welcome">
      <div className="tc-welcome-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        Диагностика
      </div>

      <h1>
        Индекс Синдрома<br />
        <span>Славного Парня</span>
      </h1>

      <p className="tc-welcome-desc">
        Научный тест по методологии Роберта Гловера. Покажет ваш профиль по 7
        ключевым сферам жизни и направления роста.
      </p>

      <div className="tc-welcome-stats">
        <div className="tc-welcome-stat">
          <div className="num">35</div>
          <div className="label">вопросов</div>
        </div>
        <div className="tc-welcome-stat">
          <div className="num">7</div>
          <div className="label">минут</div>
        </div>
        <div className="tc-welcome-stat">
          <div className="num">7</div>
          <div className="label">сфер жизни</div>
        </div>
      </div>

      <div className="tc-welcome-divider" />

      <button
        className="tc-btn-primary"
        onClick={onStart}
        disabled={isStarting}
      >
        Начать тест
      </button>

      <div className="tc-meta-line">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Результаты конфиденциальны. Правильных ответов нет.
      </div>
    </div>
  );
}
