export default function HomePage() {
  return (
    <main className="travel-page">
      <div className="travel-hero">
        <h1 className="travel-title">🌍 Мои путешествия</h1>
        <p className="travel-subtitle">
          Интерактивная карта посещённых регионов России, Таиланда и Грузии.
        </p>

        <div className="travel-cards">
          <a className="travel-card travel-card--primary" href="/travel/map.html">
            <span className="travel-card-badge">Основная</span>
            <span className="travel-card-title">HTML-версия</span>
            <span className="travel-card-desc">
              Интерактивная карта на Leaflet — клики по регионам, города, статистика,
              переключение стран.
            </span>
            <span className="travel-card-cta">Открыть →</span>
          </a>

          <a className="travel-card travel-card--secondary" href="/travel/map.svg">
            <span className="travel-card-badge">Альтернативная</span>
            <span className="travel-card-title">SVG-версия</span>
            <span className="travel-card-desc">
              Статичная векторная карта — лёгкая, без внешних библиотек. Файл ожидается:
              <code>public/travel/map.svg</code>.
            </span>
            <span className="travel-card-cta">Открыть →</span>
          </a>
        </div>
      </div>
    </main>
  );
}
