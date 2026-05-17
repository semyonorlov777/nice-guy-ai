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

        {/* ── Раздел «Почему именно так» ── */}
        <section id="why" className="demo-why">
          <h2 className="demo-why__title">Почему именно так — короткая выжимка из исследований</h2>
          <p className="demo-why__lead">
            Два независимых отчёта (Gemini Deep Research и Claude Research)
            проанализировали 15+ примеров лендингов AI-продуктов и UX-литературу
            (NN/g, Cialdini, Baymard, Wroblewski). Ниже — где они сошлись,
            где разошлись, и почему в варианте C принято именно это решение.
          </p>

          <h3 className="demo-why__h3">Где исследования сошлись (взято во всех трёх вариантах)</h3>
          <ul className="demo-why__list">
            <li>
              <strong>Чат на первом экране, не за кнопкой «начать».</strong> Самое
              сильное обещание продукта — ты сразу пишешь AI. Без скролла, без модала,
              без лишнего клика.
            </li>
            <li>
              <strong>Прозрачность «это AI-симулятор, не Гловер на проводе».</strong>{" "}
              Снимает скепсис ЦА «ещё одна игрушка». Nature (2025):{" "}
              <em>«transparency reduces skepticism even among those predisposed to distrust AI»</em>.
            </li>
            <li>
              <strong>Готовые «ёлочки» вместо пустого инпута.</strong> Снимают
              «паралич чистого листа» — пустые состояния без подсказок главная
              причина оттока, по NN/g.
            </li>
            <li>
              <strong>«Войти» доступно отдельно.</strong> Для возвращающихся,
              не в основном потоке внимания.
            </li>
            <li>
              <strong>5 сообщений бесплатно без регистрации.</strong>{" "}
              Gradual engagement по Wroblewski: «conversions went up 29%», когда
              регистрация переносится после первого опыта.
            </li>
          </ul>

          <h3 className="demo-why__h3">Где исследования разошлись — и что выбрано в варианте C</h3>
          <div className="demo-why__table-wrap">
            <table className="demo-why__table">
              <thead>
                <tr>
                  <th>Решение</th>
                  <th>Gemini сказал</th>
                  <th>Claude сказал</th>
                  <th>В варианте C</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Обложка книги в Hero</strong></td>
                  <td>Да, как proof методологии</td>
                  <td>Нет — 0 из 16 проанализированных AI-сайтов делают так. Перетягивает визуальный вес у чата.</td>
                  <td className="demo-why__td-decision">Нет — обложка уезжает в секцию автора ниже</td>
                </tr>
                <tr>
                  <td><strong>Большая кнопка «Начать разбор»</strong></td>
                  <td>Да, золотая, фокусирует чат</td>
                  <td>Нет — input справа уже primary action, кнопка добавляет визуальный шум</td>
                  <td className="demo-why__td-decision">Нет — input справа единственный главный элемент</td>
                </tr>
                <tr>
                  <td><strong>Имя автора в Hero</strong></td>
                  <td>Крупно «Доктор Роберт Гловер» с регалиями</td>
                  <td>В подзаголовке через тираж. Cialdini: авторитет работает, только если узнан. Гловера в РФ знают ≈5%.</td>
                  <td className="demo-why__td-decision">В подзаголовке: «тираж 2+ млн копий, 20+ языков»</td>
                </tr>
                <tr>
                  <td><strong>Цена 990 ₽/мес</strong></td>
                  <td>Да, прямо в Hero — сигнал премиальности</td>
                  <td>Нет — сначала ценность через диалог, цена ниже сгиба</td>
                  <td className="demo-why__td-decision">Только намёк в микрокопии «без регистрации, первые 5 сообщений бесплатно»</td>
                </tr>
                <tr>
                  <td><strong>Proof в Hero</strong></td>
                  <td>3 пункта программы с иконками</td>
                  <td>1 строка с конкретными цифрами. Medill Spiegel: конкретные цифры конвертируют сильнее списков обещаний.</td>
                  <td className="demo-why__td-decision">1 строка: «Психотест из 35 вопросов · Goodreads 4,04★ (24 650 оценок)»</td>
                </tr>
                <tr>
                  <td><strong>Заголовок H1</strong></td>
                  <td>«Хватит искать чужого одобрения. Верни контроль над своей жизнью.»</td>
                  <td>«Перестань быть „хорошим парнем". Стань тем, кем хотел.» — прямая отсылка к названию книги, инсайдеры распознают</td>
                  <td className="demo-why__td-decision">Версия Claude — короче и точнее в боль ЦА</td>
                </tr>
                <tr>
                  <td><strong>«Войти»</strong></td>
                  <td>В карточке Hero отдельной ссылкой</td>
                  <td>В правом верхнем углу страницы вне Hero. 14 из 16 проанализированных AI-сайтов так делают.</td>
                  <td className="demo-why__td-decision">Вне Hero, в мини-шапке</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="demo-why__h3">Почему в спорных местах вес у Claude</h3>
          <p className="demo-why__p">
            Claude глубже опирается на источники с цитатами (NN/g, Cialdini, Baymard,
            Pernice, Wroblewski). Gemini больше про прецеденты (что делают Replika,
            Rosebud, Wysa). Когда они расходятся, в C приоритет — рекомендации,
            привязанные к проверенным принципам, а не «у конкурентов сделано так».
          </p>
          <p className="demo-why__p">
            Главный принцип варианта C:{" "}
            <strong>левая колонка не продаёт — она легитимизирует и разрешает
            начать диалог.</strong>{" "}
            Продажа происходит уже в самом разговоре с AI и в секциях ниже Hero.
          </p>

          <h3 className="demo-why__h3">Чем варианты отличаются по сути</h3>
          <div className="demo-why__variants">
            <div className="demo-why__variant">
              <div className="demo-why__variant-tag">Вариант C</div>
              <p>
                Минимум визуальных конкурентов у чата. Подходит, если веришь,
                что качество AI-ответа само продаст продукт после 1–2 сообщений.
                Радикально-минималистичный chat-first.
              </p>
            </div>
            <div className="demo-why__variant">
              <div className="demo-why__variant-tag">Вариант A</div>
              <p>
                Обложка, регалии, кнопка, цена — всё на месте. Подходит, если
                ЦА любит явные сигналы «куда нажать» и доказательства до клика.
                Привычная структура лендинга, но с активным чатом справа.
              </p>
            </div>
            <div className="demo-why__variant">
              <div className="demo-why__variant-tag">Вариант B</div>
              <p>
                Только чат на весь экран. Подходит для AI-нативной ЦА,
                привыкшей к Perplexity / Claude.ai. Самый агрессивный отказ
                от классического лендинга.
              </p>
            </div>
          </div>

          <h3 className="demo-why__h3">Что НЕ вошло ни в один вариант (и почему)</h3>
          <ul className="demo-why__list">
            <li>
              <strong>Бейджи SOC2 / OpenAI / «Powered by AI»</strong> — для B2C
              это визуальный шум; логотип OpenAI обесценивает уникальность бренда.
            </li>
            <li>
              <strong>Абстрактные обещания типа «найди себя» / «измени жизнь»</strong>{" "}
              — ЦА мужчин 25–45 читает это как «маркетинговую воду».
            </li>
            <li>
              <strong>Принудительная регистрация до первого диалога</strong> —
              мгновенный отток холодного трафика.
            </li>
            <li>
              <strong>Роботизированный тон AI («Привет, я AI-модель…»)</strong>{" "}
              — убивает доверие в первой строке.
            </li>
          </ul>
        </section>

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
