"use client";

import Link from "next/link";

const SCHOOL_URL = "https://volynsky.school";
const CLUB_URL = "https://volynsky.school/club";

export function OfferScreen() {
  return (
    <div className="funnel-screen funnel-offer">
      <div className="funnel-offer-inner">
        <div className="funnel-offer-eyebrow">Следующий шаг</div>
        <h1 className="funnel-offer-title">
          Разбор — это первый слой.
          <br />
          <span>Дальше начинается работа.</span>
        </h1>

        <p className="funnel-offer-desc">
          В разборе вы увидели свой паттерн. Этого уже достаточно, чтобы
          начать замечать его в моменте. Но чтобы он перестал управлять
          вашей жизнью — нужна не статья и не курс «на посмотреть»,
          а практика.
        </p>

        <div className="funnel-offer-cards">
          <div className="funnel-offer-card">
            <div className="funnel-card-tag">Лёгкий вход</div>
            <h3>Клуб</h3>
            <p>
              Закрытое пространство со встречами, разборами и поддержкой.
              Хорошее место, чтобы попробовать как это работает — без обязательств
              и без больших вложений.
            </p>
            <a
              href={CLUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="funnel-btn-outline"
            >
              Узнать про клуб
            </a>
          </div>

          <div className="funnel-offer-card funnel-offer-card-primary">
            <div className="funnel-card-tag">Системный путь</div>
            <h3>Годовая программа</h3>
            <p>
              Год последовательной работы с методикой. Когда вы готовы
              менять не симптом, а сценарий — это рабочий формат.
            </p>
            <a
              href={SCHOOL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="funnel-btn-primary"
            >
              Перейти на сайт школы
            </a>
          </div>
        </div>

        <div className="funnel-offer-bottom">
          <Link href="/funnel/result" className="funnel-link-back">
            ← Вернуться к разбору
          </Link>
        </div>
      </div>
    </div>
  );
}
