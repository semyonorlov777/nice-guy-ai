import type { TestConfig } from "@/lib/test-config";

interface WelcomeScreenProps {
  onStart: () => void;
  isStarting: boolean;
  testConfig: TestConfig;
}

export function WelcomeScreen({ onStart, isStarting, testConfig }: WelcomeScreenProps) {
  const ui = testConfig.ui_config;

  return (
    <div className="tc-screen tc-welcome">
      <div className="tc-welcome-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        {ui.welcome_badge ?? "Диагностика"}
      </div>

      <h1 dangerouslySetInnerHTML={{ __html: ui.welcome_title ?? testConfig.title }} />

      {(ui.welcome_subtitle || ui.welcome_description || testConfig.description) && (
        <p className="tc-welcome-desc">
          {ui.welcome_description ?? ui.welcome_subtitle ?? testConfig.description}
        </p>
      )}

      <div className="tc-welcome-stats">
        {ui.welcome_stats.map((stat, i) => (
          <div key={i} className="tc-welcome-stat">
            <div className="num">{stat.num}</div>
            <div className="label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="tc-welcome-divider" />

      <button
        className="tc-btn-primary"
        onClick={onStart}
        disabled={isStarting}
      >
        {ui.welcome_cta ?? "Начать тест"}
      </button>

      <div className="tc-meta-line">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {ui.welcome_meta ?? "Результаты конфиденциальны. Правильных ответов нет."}
      </div>
    </div>
  );
}
