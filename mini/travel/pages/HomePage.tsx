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

          <a className="travel-card travel-card--secondary" href="/travel/russia-regions.svg">
            <span className="travel-card-badge">SVG</span>
            <span className="travel-card-title">Регионы России</span>
            <span className="travel-card-desc">
              Лёгкая векторная карта-сетка: квадрат на каждый субъект РФ, посещённые
              подсвечены зелёным.
            </span>
            <span className="travel-card-cta">Открыть →</span>
          </a>

          <a className="travel-card travel-card--secondary" href="/travel/russia-regions.html">
            <span className="travel-card-badge">HTML</span>
            <span className="travel-card-title">Регионы России</span>
            <span className="travel-card-desc">
              Waffle-карта: страна → регион → города. Клик на регион открывает
              его waffle-сетку городов с подсветкой посещений.
            </span>
            <span className="travel-card-cta">Открыть →</span>
          </a>

          <a className="travel-card travel-card--secondary" href="/travel/russia-regions-geo.html">
            <span className="travel-card-badge">Гео · тест</span>
            <span className="travel-card-title">Регионы России</span>
            <span className="travel-card-desc">
              Тот же drill-down, но города показаны точками поверх
              контура самого региона — по реальным координатам.
            </span>
            <span className="travel-card-cta">Открыть →</span>
          </a>
        </div>
      </div>
    </main>
  );
}
