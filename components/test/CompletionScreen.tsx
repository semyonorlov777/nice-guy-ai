interface CompletionScreenProps {
  onViewResults: () => void;
}

export function CompletionScreen({ onViewResults }: CompletionScreenProps) {
  return (
    <div className="tc-screen tc-done-screen">
      <div className="tc-done-orb">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2>Тест завершён</h2>

      <p className="tc-done-text">
        Все 35 вопросов пройдены.
        <br />
        Ваш персональный профиль готов.
      </p>

      <button className="tc-btn-primary" onClick={onViewResults}>
        Посмотреть результаты
      </button>

      <div className="tc-meta-line">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Результаты видите только вы
      </div>
    </div>
  );
}
