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
          <h2 className="demo-why__title">Почему сделано так</h2>
          <p className="demo-why__lead">
            Два исследования (одно — от Gemini, второе — от Claude) разобрали
            15 лендингов похожих продуктов и научные работы по тому, как
            устроены первые экраны. Ниже — где они согласились, где спорили
            друг с другом, и какое решение в итоге принято в варианте C.
          </p>

          <h3 className="demo-why__h3">В чём оба исследования согласились</h3>
          <ul className="demo-why__list">
            <li>
              <strong>Чат должен быть прямо на первом экране, без кнопки «начать».</strong>{" "}
              Сейчас на действующем лендинге чат на 9-й секции из 10, до него
              надо долго листать. Это один из главных провалов текущей версии.
            </li>
            <li>
              <strong>В приветствии чата нужно прямо сказать: «это AI, не сам Гловер».</strong>{" "}
              Аудитория мужчин 25–45 скептична к AI. Если попытаться выдать
              чат за самого автора — почувствуют обман и закроют вкладку.
              Честность даёт больше доверия.
            </li>
            <li>
              <strong>В чате должны быть готовые кнопки с фразами для начала разговора.</strong>{" "}
              Пустое поле ввода пугает: человек не знает что писать.
              С готовыми кнопками — один клик, и разговор начался.
            </li>
            <li>
              <strong>Кнопка «Войти» — отдельно, не в основной картинке.</strong>{" "}
              Кто уже зарегистрирован — должен сразу её найти, а не искать
              среди обещаний для новых.
            </li>
            <li>
              <strong>Первые 5 сообщений — без регистрации.</strong>{" "}
              Если попросить регистрацию сразу — человек уйдёт. Сначала надо
              дать попробовать, и только потом — окно входа.
            </li>
          </ul>

          <h3 className="demo-why__h3">В чём исследования поспорили и что выбрано</h3>
          <div className="demo-why__table-wrap">
            <table className="demo-why__table">
              <thead>
                <tr>
                  <th>Вопрос</th>
                  <th>Gemini за</th>
                  <th>Claude против</th>
                  <th>В варианте C</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Показывать ли обложку книги</strong></td>
                  <td>Да — обложка делает программу «материальной», показывает, что за продуктом стоит реальная книга</td>
                  <td>Нет — обложка перетягивает взгляд на себя, человек смотрит на неё, а не на чат. Из 16 проверенных AI-продуктов обложку в первом экране не показывает ни один.</td>
                  <td className="demo-why__td-decision">Убрали. Обложка теперь в блоке «об авторе» ниже</td>
                </tr>
                <tr>
                  <td><strong>Большая кнопка «Начать разбор»</strong></td>
                  <td>Да — явно показывает, куда нажать. Привычно по другим лендингам.</td>
                  <td>Нет — кнопка делает чат «вторым шагом», как будто сначала надо нажать, потом разговаривать. Само поле ввода — и есть главное действие, второй сигнал лишний.</td>
                  <td className="demo-why__td-decision">Убрали. Главный элемент — само поле ввода в чате</td>
                </tr>
                <tr>
                  <td><strong>Имя автора крупно</strong></td>
                  <td>Да — «Доктор Гловер» работает как авторитет, делает продукт серьёзнее</td>
                  <td>Не работает, потому что в России Гловера знают ~5%. Авторитет имени срабатывает только если имя узнают. Лучше показать, что книга реальная: тираж 2 млн копий, 20+ языков.</td>
                  <td className="demo-why__td-decision">Имя не выделяем. Доверие — через цифры: «тираж 2 млн, 20+ языков»</td>
                </tr>
                <tr>
                  <td><strong>Цена 990 ₽ на первом экране</strong></td>
                  <td>Да — премиальный продукт не должен прятать цену, это сигнал серьёзности</td>
                  <td>Нет — на первом экране человек ещё не понял ценность, цена выглядит как «продают за деньги». Сначала диалог, потом цена.</td>
                  <td className="demo-why__td-decision">Только намёком: «5 сообщений бесплатно, потом 990 ₽». Без акцента.</td>
                </tr>
                <tr>
                  <td><strong>Что показать в доказательство</strong></td>
                  <td>Три плюса с иконками: тест, 46 упражнений, приватность</td>
                  <td>Список из трёх плюсов читается как «маркетинговая вода». Лучше одна строка с цифрами, которые можно проверить.</td>
                  <td className="demo-why__td-decision">Одна строка: «Тест из 35 вопросов · оценка 4,04 из 5 на Goodreads, 24 650 отзывов»</td>
                </tr>
                <tr>
                  <td><strong>Заголовок</strong></td>
                  <td>«Хватит искать чужого одобрения. Верни контроль над своей жизнью.»</td>
                  <td>«Перестань быть „хорошим парнем". Стань тем, кем хотел.» — это название книги Гловера. Те, кто читал — сразу узнают.</td>
                  <td className="demo-why__td-decision">Версия Claude — короче и напрямую про боль</td>
                </tr>
                <tr>
                  <td><strong>Где «Войти»</strong></td>
                  <td>В карточке слева, отдельной ссылкой под основным блоком</td>
                  <td>Сверху страницы, в углу. Так делают 14 из 16 проверенных AI-сайтов.</td>
                  <td className="demo-why__td-decision">Сверху, отдельной тонкой полосой</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="demo-why__h3">Почему в спорных местах чаще выбирали Claude</h3>
          <p className="demo-why__p">
            Claude чаще ссылается на конкретные исследования с цифрами и
            данными. Gemini больше про «у Replika/Rosebud сделано так».
            В спорных местах вес отдавался не «у конкурентов так», а «есть
            исследование, которое объясняет почему».
          </p>
          <p className="demo-why__p">
            Главная идея варианта C:{" "}
            <strong>задача левой части — не продать программу, а снять
            сомнения и разрешить начать разговор.</strong>{" "}
            Продажа происходит уже внутри самого разговора с AI и в нижних
            секциях лендинга.
          </p>

          <h3 className="demo-why__h3">Чем три варианта отличаются по сути</h3>
          <div className="demo-why__variants">
            <div className="demo-why__variant">
              <div className="demo-why__variant-tag">Вариант C</div>
              <p>
                Чат — главный элемент, всё остальное приглушено. Подходит,
                если веришь, что качество ответа AI само продаст программу
                после первого-второго сообщения. Самый радикальный.
              </p>
            </div>
            <div className="demo-why__variant">
              <div className="demo-why__variant-tag">Вариант A</div>
              <p>
                Всё на виду: обложка, автор, кнопка, цена. Подходит, если
                аудитория хочет до клика понимать, что покупает. Привычная
                структура лендинга, но с живым чатом справа.
              </p>
            </div>
            <div className="demo-why__variant">
              <div className="demo-why__variant-tag">Вариант B</div>
              <p>
                Только чат во весь экран, без левой колонки. Подходит для
                тех, кто уже привык к ChatGPT и Perplexity. Самый сильный
                разрыв с классическим лендингом.
              </p>
            </div>
          </div>

          <h3 className="demo-why__h3">Что НЕ вошло ни в один вариант</h3>
          <ul className="demo-why__list">
            <li>
              <strong>Значки «SOC2», «Powered by OpenAI» и подобные.</strong>{" "}
              Для обычного покупателя это шум, который не вызывает доверия.
              А логотип OpenAI обесценивает свой бренд — «они просто обёртка
              над чужой технологией».
            </li>
            <li>
              <strong>Расплывчатые обещания вроде «измени жизнь» или «найди себя».</strong>{" "}
              Мужчина 25–45 читает такое как маркетинговую воду и закрывает
              вкладку.
            </li>
            <li>
              <strong>Регистрация до первого сообщения.</strong>{" "}
              Самый верный способ потерять половину пришедших.
            </li>
            <li>
              <strong>Роботизированное приветствие «Привет, я AI-модель…»</strong>{" "}
              — разрушает доверие в первой же строке.
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
