"use client";

import Link from "next/link";

export function WelcomeScreen() {
  return (
    <div className="funnel-screen funnel-welcome">
      <div className="funnel-welcome-inner">
        <div className="funnel-welcome-badge">Глубинная диагностика</div>
        <h1>
          Узнайте свой
          <br />
          <span>главный паттерн</span>
        </h1>
        <p className="funnel-welcome-desc">
          За 15–20 минут — разговор, в котором вы увидите ту сквозную линию,
          из-за которой одни и те же сложности повторяются в вашей жизни.
        </p>

        <div className="funnel-welcome-bullets">
          <div className="funnel-bullet">
            <span className="funnel-bullet-num">15–20</span>
            <span className="funnel-bullet-label">вопросов, которые подстраиваются под ваши ответы</span>
          </div>
          <div className="funnel-bullet">
            <span className="funnel-bullet-num">1</span>
            <span className="funnel-bullet-label">персональный разбор — не диагноз, а узнавание себя</span>
          </div>
          <div className="funnel-bullet">
            <span className="funnel-bullet-num">0</span>
            <span className="funnel-bullet-label">регистраций, телефонов, email — анонимно</span>
          </div>
        </div>

        <Link href="/funnel/test" className="funnel-btn-primary">
          Начать разговор
        </Link>

        <div className="funnel-welcome-note">
          Это не тест с правильными ответами. Чем честнее вы отвечаете —
          тем точнее разбор.
        </div>
      </div>
    </div>
  );
}
