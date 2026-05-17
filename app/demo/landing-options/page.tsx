import type { Metadata } from "next";
import Link from "next/link";
import "./demo.css";

export const metadata: Metadata = {
  title: "Демо: упрощение входа",
  robots: { index: false, follow: false },
};

export default function DemoLandingOptionsPage() {
  return (
    <div className="demo-picker">
      <div className="demo-picker__inner">
        <div className="demo-picker__eyebrow">Демо</div>
        <h1 className="demo-picker__title">
          Радикальное упрощение входа на лендинге программы
        </h1>
        <p className="demo-picker__lead">
          Сейчас на лендинге программы первый экран — Hero с кнопкой «начать»,
          которая скроллит к чат-демо <strong>на 9-й секции из 10</strong>.
          До диалога с AI — 3+ действия. Ниже — два варианта, как сделать так,
          чтобы человек начал писать сразу, без скролла и без клика «начать».
        </p>

        <div className="demo-picker__compare">
          <div className="demo-picker__compare-row">
            <span className="demo-picker__compare-label">Сейчас</span>
            <span className="demo-picker__compare-bar demo-picker__compare-bar--bad" />
            <span className="demo-picker__compare-value">
              клик «начать» → скролл → клик в поле → печать
            </span>
          </div>
          <div className="demo-picker__compare-row">
            <span className="demo-picker__compare-label">Новый</span>
            <span className="demo-picker__compare-bar demo-picker__compare-bar--good" />
            <span className="demo-picker__compare-value">
              клик в поле → печать
            </span>
          </div>
        </div>

        <div className="demo-picker__cards demo-picker__cards--three">
          <Link href="/demo/landing-options/c" className="demo-picker__card demo-picker__card--featured">
            <div className="demo-picker__card-tag">Вариант C · по двум исследованиям ⭐</div>
            <h2 className="demo-picker__card-title">Chat-first: минимальный левый якорь</h2>
            <p className="demo-picker__card-desc">
              Синтез отчётов Gemini и Claude. Слева — только текст: eyebrow,
              крупный заголовок, подзаголовок с автором через тираж, одна строка
              proof, микрокопия про триал. Без обложки и без большой кнопки —
              чат справа становится primary action (паттерн Perplexity /
              Claude.ai / Cal.com).
            </p>
            <ul className="demo-picker__card-list">
              <li>+ Чат не конкурирует с другими элементами за внимание</li>
              <li>+ Авторитет автора — через цифры (тираж 2+ млн, 20+ языков)</li>
              <li>+ Proof — Goodreads 4,04★ (24 650 оценок) + 35 вопросов теста</li>
              <li>− Скептику без кнопки «начать» может быть непривычно</li>
            </ul>
            <span className="demo-picker__card-go">Посмотреть →</span>
          </Link>

          <Link href="/demo/landing-options/a" className="demo-picker__card">
            <div className="demo-picker__card-tag">Вариант A · по первому исследованию</div>
            <h2 className="demo-picker__card-title">Hero с обложкой и кнопкой</h2>
            <p className="demo-picker__card-desc">
              Слева — обложка книги, доктор Гловер с регалиями, 3 пункта proof
              (тест, 46 упражнений, приватность), крупная кнопка «Начать
              бесплатный разбор» и цена 990 ₽/мес. Кнопка пульсирует чат
              справа как визуальный мост.
            </p>
            <ul className="demo-picker__card-list">
              <li>+ Привычная структура: видна цена, обложка, кнопка</li>
              <li>+ Кнопка явно ведёт в чат</li>
              <li>− Много элементов конкурируют с самим чатом</li>
            </ul>
            <span className="demo-picker__card-go">Посмотреть →</span>
          </Link>

          <Link href="/demo/landing-options/b" className="demo-picker__card">
            <div className="demo-picker__card-tag">Вариант B · максимальный</div>
            <h2 className="demo-picker__card-title">Чат во весь первый экран</h2>
            <p className="demo-picker__card-desc">
              Сверху — тонкая шапка с названием программы и «Войти». Ниже — окно
              чата почти на весь экран. Без левой колонки совсем.
            </p>
            <ul className="demo-picker__card-list">
              <li>+ Максимальное вовлечение в диалог</li>
              <li>+ На мобилке весь экран — полезная высота</li>
              <li>− Нет ни автора, ни обещания на первом экране</li>
            </ul>
            <span className="demo-picker__card-go">Посмотреть →</span>
          </Link>
        </div>

        <div className="demo-picker__hint">
          <strong>Что общего:</strong> чат — это уже существующий{" "}
          <code>AnonymousChat</code>. Он сам открывает окно входа на 5-м сообщении.
          Логика регистрации, методы входа (Telegram, Яндекс, Google, e-mail) —
          без изменений. Реальные лендинги программ не тронуты, демо живёт под
          отдельным URL.
        </div>

        <div className="demo-picker__compare-link">
          <a
            href="/program/nice-guy"
            target="_blank"
            rel="noreferrer"
            className="demo-picker__compare-link-a"
          >
            ↗ Открыть текущий лендинг (для сравнения)
          </a>
        </div>
      </div>
    </div>
  );
}
