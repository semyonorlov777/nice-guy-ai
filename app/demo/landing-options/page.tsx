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
          Сейчас на лендинге программы первый экран — заглавный блок с кнопкой
          «начать», которая просто прокручивает страницу к чат-демо{" "}
          <strong>на 9-й секции из 10</strong>. До разговора с AI — 3+ действия.
          Ниже — два варианта, как сделать так, чтобы человек начал писать сразу,
          без прокрутки и без клика «начать».
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
            <div className="demo-picker__card-tag">Вариант C · компактный ⭐</div>
            <h2 className="demo-picker__card-title">Заголовок сверху, блоки компактно</h2>
            <p className="demo-picker__card-desc">
              Слева: eyebrow → крупный заголовок → три компактных блока (книга,
              автор, сообщество). Справа — живой чат. Без кнопки «начать»,
              без цены. «Войти» отдельно сверху.
            </p>
            <ul className="demo-picker__card-list">
              <li>+ Самая чистая композиция, чат не теряется</li>
              <li>+ Заголовок сразу задаёт смысл</li>
              <li>+ Блоки компактные — не перетягивают внимание</li>
            </ul>
            <span className="demo-picker__card-go">Посмотреть →</span>
          </Link>

          <Link href="/demo/landing-options/a" className="demo-picker__card">
            <div className="demo-picker__card-tag">Вариант A · крупные блоки</div>
            <h2 className="demo-picker__card-title">Те же блоки, но крупнее</h2>
            <p className="demo-picker__card-desc">
              Та же структура что C (заголовок сверху, потом блоки), но размер
              блоков больше: обложка крупнее, фото автора крупнее, цифра
              соцдока выделена сильнее. Чат справа — также без кнопки.
            </p>
            <ul className="demo-picker__card-list">
              <li>+ Книга, автор и сообщество читаются легче с одного взгляда</li>
              <li>+ Подходит, если ЦА «больше глазами», а не «глубоко в текст»</li>
              <li>− Блоки занимают больше места, чат визуально слабее</li>
            </ul>
            <span className="demo-picker__card-go">Посмотреть →</span>
          </Link>

          <Link href="/demo/landing-options/d" className="demo-picker__card">
            <div className="demo-picker__card-tag">Вариант D · контекст до заголовка</div>
            <h2 className="demo-picker__card-title">Сначала блоки, потом заголовок</h2>
            <p className="demo-picker__card-desc">
              Обратный порядок: eyebrow → книга → автор → сообщество →{" "}
              <em>и только потом</em> крупный заголовок-обещание. Идея: пока
              человек не понял, о какой книге и каком авторе речь — заголовок
              ему ничего не говорит. Сначала якорь, потом обещание.
            </p>
            <ul className="demo-picker__card-list">
              <li>+ Заголовок становится «выводом» из контекста выше</li>
              <li>+ Подходит для холодного трафика, не знающего книгу/автора</li>
              <li>− Заголовок уходит вниз — теряет роль главного «крючка»</li>
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
            Два исследования (Gemini и Claude) разобрали 15 лендингов похожих
            продуктов и научные работы по тому, как устроены первые экраны.
            Ниже — какие решения приняты для двух вариантов и почему.
          </p>

          <h3 className="demo-why__h3">Зафиксированные принципы (одинаково во всех вариантах)</h3>
          <p className="demo-why__p">
            Каждый принцип в формате «<strong>что зафиксировано → почему так
            (из исследований) → как сделано в макете</strong>». Это чтобы
            при следующем обсуждении не возвращаться к причинам — они здесь.
          </p>

          <div className="demo-principle">
            <div className="demo-principle__title">1. Чат прямо на первом экране, без кнопки «начать»</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              На текущем лендинге чат живёт на 9-й секции из 10 — до него надо
              долго листать. До разговора с AI — 3+ действий (клик «начать» →
              скролл → клик в поле → печать). Это главный провал текущей версии.
              По обоим исследованиям (Gemini и Claude) — единогласное решение.
              Отдельная кнопка «Начать разбор» в варианте A тоже убрана: она
              делала чат «вторым шагом» вместо первого. Само поле ввода — и
              есть главное действие.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              Чат справа в первом экране, поле ввода — единственное главное
              действие. Никаких кнопок-дублёров.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">2. Привязка к понятному: книга и автор обязательны</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              Критерий, который выяснился по ходу обсуждения. Наш продукт —
              не «AI-помощник», а тренажёр по конкретной книге. Аудитория
              приходит именно по знакомству с книгой или автором — это её
              единственная точка опоры. Без обложки и регалий первый экран
              превращается в «ещё одну AI-игрушку». Так был убран вариант
              «чат во весь экран» (без обложки и автора).
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              Обложка книги и блок автора с регалиями — на первом экране слева.
              В варианте C компактно, в варианте A крупнее.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">3. Три отдельных блока слева: книга, автор, сообщество</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              В предыдущей версии книга и регалии автора были свалены в одну
              карточку — каша, ничего не считывается. Каждый блок должен
              отвечать за своё, чтобы взгляд понимал иерархию.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              <em>Книга</em>: обложка + название «Хватит быть славным парнем» +
              тираж 2+ млн в 20+ языках + «Топ ЛитРес · 24 650 отзывов читателей».{" "}
              <em>Автор</em>: фото + «Доктор Роберт Гловер» + «Клинический
              психотерапевт, США · 30 лет работает с мужчинами».{" "}
              <em>Сообщество</em>: «2 700+ мужчин в русскоязычном сообществе» +
              «уже работают по методу Гловера».
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">4. Авторитет автора — через цифры и конкретику, а не звания</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              По Cialdini (Influence): авторитет имени срабатывает только если
              имя узнают. Гловера в России знают ~5% — для большинства имя
              ничего не даёт. Дают цифры (тираж, языки) и конкретные регалии
              (что именно автор делает). «30 лет практики» — сыро, непонятно
              чем занимается. «30 лет работает с мужчинами» — сразу ясно.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              В блоке автора — «Клинический психотерапевт, США · 30 лет
              работает с мужчинами». В блоке книги — тираж 2+ млн копий,
              20+ языков, 24 650 отзывов.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">5. Название книги — только по-русски</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              «No More Mr. Nice Guy» — английское оригинальное название. На
              русском рынке у книги есть официальное издание «Хватит быть
              славным парнем». Английское название работает на ~5% знающих
              оригинал, остальным — лишний барьер.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              В блоке книги — «Хватит быть славным парнем». В заголовке H1 —
              «Перестань быть „хорошим парнем"» — лёгкая отсылка к названию
              для тех, кто узнает.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">6. Социалка — через сообщество, не через Goodreads</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              Слово «Goodreads» русскому покупателю ничего не говорит. По
              Medill Spiegel Research (Northwestern): конкретные цифры
              конвертируют сильнее абстрактных обещаний — но только если
              цифры понятны аудитории. Для нашего рынка — это число читателей
              на ЛитРес и число активных мужчин в русскоязычном сообществе.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              «Топ ЛитРес · 24 650 отзывов читателей» — в блоке книги.
              «2 700+ мужчин в русскоязычном сообществе» — отдельным блоком
              с золотым акцентом. Цифра пока плейсхолдер, заменим на реальную
              из Telegram-канала и группы.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">7. Заголовок — отсылка к названию книги</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              По SaaSHero benchmark: заголовки до 44 символов работают лучше.
              По Claude Research: для аудитории, читавшей книгу, прямая
              отсылка к названию мгновенно даёт узнавание. Для не читавших —
              понимается по тону.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              «Перестань быть „хорошим парнем". Стань тем, кем хотел.» —
              в обоих вариантах одинаково.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">8. Приветствие чата — «AI-тренажёр», без слова «проводник»</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              По исследованию Nature (2025, «AI algorithm transparency»):
              прозрачность снижает скепсис. Слово «AI» в первой строке —
              даёт честность. Но слова «проводник», «помощник» в духовно-
              эзотерическом тоне отталкивают ЦА мужчин 25–45 (звучит как
              курсы коучинга). «Тренажёр» — рабочий, инструментальный тон.
              И не дублируем регалии автора (они уже видны слева).
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              «Привет. Я AI-тренажёр по методу Роберта Гловера. Расскажи
              одну ситуацию: где ты последний раз сказал „да", когда хотел
              сказать „нет"?» Две короткие строки, конкретный вопрос.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">9. Готовые «ёлочки» — конкретные ситуации, не философия</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              По Nielsen Norman Group: пустое поле ввода даёт «страх чистого
              листа» — человек не знает, что писать, и уходит. Готовые кнопки
              снимают этот барьер до одного клика. Кнопки с конкретными
              ситуациями работают сильнее философских тем.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              Под приветствием AI — три кнопки: «Сказал „да" жене, когда
              хотел отдохнуть», «Промолчал на работе, когда был не согласен»,
              «Сам не понимаю, чего хочу». Реальные ситуации мужчины 25–45.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">10. Регистрация — после 5 первых сообщений</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              По Luke Wroblewski (исследование Twitter, 2010): когда регистрацию
              перенесли после первого опыта, конверсия выросла на 29%. Принцип
              «gradual engagement» — сначала ценность, потом просьба.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              Первые 5 сообщений в чате — без регистрации. На 6-м появляется
              окно входа (Telegram / Яндекс / Google / e-mail). Логика самого
              окна не меняется, это уже работает в проде.
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">11. «Войти» — отдельно сверху страницы</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              По Claude Research (14 из 16 проанализированных AI-сайтов):
              «Войти» всегда отдельно от основного действия. Кто уже
              зарегистрирован — должен сразу её найти. В Hero «Войти»
              конкурирует с чатом за внимание новых пользователей.
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              В варианте C — тонкая полоса сверху с лого и «Войти».
              В варианте A — отдельная мелкая ссылка под главной кнопкой
              «У меня уже есть аккаунт».
            </div>
          </div>

          <div className="demo-principle">
            <div className="demo-principle__title">12. Старая полоска с 4 цифрами под Hero — убрана</div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Почему</span>
              В текущем лендинге под Hero есть полоска: «По методике Гловера ·
              Бестселлер, 20+ языков», «№1 мужское сообщество в РФ · 200+
              встреч», «46 упражнений · Программа в 8 главах», «Система с
              обратной связью · Помнит каждый разговор». После того как блоки
              книги/автора/сообщества появились в Hero — две из четырёх цифр
              дублируют Hero, а две оставшихся слабее (200+ встреч vs 2 700+
              мужчин).
            </div>
            <div className="demo-principle__row">
              <span className="demo-principle__label">Как</span>
              На демо-страницах эту секцию убрали полностью. Под Hero сразу
              идёт «Что изменится на самом деле».
            </div>
          </div>

          <h3 className="demo-why__h3">Чем отличаются варианты A, C и D</h3>
          <p className="demo-why__p">
            Кнопка «Начать разбор» убрана везде — само поле ввода в чате и есть
            главное действие. Цена 990 ₽ нигде не показывается на первом экране.
            Отличия между вариантами — только в размере блоков и порядке
            элементов слева.
          </p>
          <div className="demo-why__table-wrap">
            <table className="demo-why__table">
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>C · компактный</th>
                  <th>A · крупные блоки</th>
                  <th>D · контекст до заголовка</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Порядок слева</strong></td>
                  <td className="demo-why__td-decision">Eyebrow → заголовок → блоки</td>
                  <td>Eyebrow → заголовок → блоки</td>
                  <td className="demo-why__td-decision">Eyebrow → блоки → заголовок</td>
                </tr>
                <tr>
                  <td><strong>Размер блоков</strong></td>
                  <td className="demo-why__td-decision">Компактные. Обложка 58×87, фото автора 42×42.</td>
                  <td>Крупные. Обложка 70×105, фото автора 48×48.</td>
                  <td className="demo-why__td-decision">Средние.</td>
                </tr>
                <tr>
                  <td><strong>Когда брать</strong></td>
                  <td className="demo-why__td-decision">Аудитория уже знает книгу/автора. Заголовок-крючок работает с первой строки.</td>
                  <td>Аудитория «больше глазами»: легче читает крупные блоки чем длинные тексты.</td>
                  <td className="demo-why__td-decision">Холодный трафик, не знающий книгу/автора. Сначала контекст («что за книга, кто автор»), потом обещание.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="demo-why__h3">Открытые вопросы (что обсуждаем дальше)</h3>
          <ul className="demo-why__list">
            <li>
              <strong>Цена 990 ₽ на первом экране — пока нет.</strong>{" "}
              На обоих вариантах сейчас цены нет: пока человек ещё не понял
              ценность через разговор, число выглядит как «продают за деньги».
              Финальная задача — сделать продукт настолько понятным с первого
              экрана, чтобы цену можно было показывать сразу. Пока не видим,
              как. Когда увидим — поставим.
            </li>
            <li>
              <strong>Цифра «2 700+ мужчин» — плейсхолдер.</strong>{" "}
              Базируется на реальных цифрах Telegram-канала и группы, но не
              является финальной. Когда соберём точную статистику —
              заменим на реальную.
            </li>
            <li>
              <strong>Что выбрать в финал — A или C.</strong>{" "}
              Это вопрос на согласование. См. таблицу выше «Чем отличаются».
            </li>
          </ul>

          <h3 className="demo-why__h3">Что НЕ вошло ни в один вариант</h3>
          <ul className="demo-why__list">
            <li>
              <strong>Значки «SOC2», «Powered by OpenAI» и подобные.</strong>{" "}
              Для обычного покупателя это шум. Логотип OpenAI обесценивает
              свой бренд — «они просто обёртка над чужой технологией».
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
            <li>
              <strong>Список из трёх обещаний (тест / 46 упражнений / приватность).</strong>{" "}
              Читался как «маркетинговая вода» и дублировал нижние секции.
            </li>
            <li>
              <strong>Длинное приветствие AI с подробными регалиями автора.</strong>{" "}
              Раньше было: «Я цифровой проводник по методу Роберта Гловера —
              клинического психотерапевта, который 30 лет лечит мужчин от
              синдрома „хорошего парня". Я не сам Гловер, я обучен на его 46
              упражнениях и сотнях разборов из практики…» — длинно и дублирует
              блок автора слева. Заменили на короткое: «Привет. Я не сам
              Гловер — цифровой проводник по его методу.»
            </li>
            <li>
              <strong>Goodreads-рейтинг в карточке книги.</strong>{" "}
              «4,04 из 5 — 24 650 отзывов читателей» — рейтинг 4,04
              требует контекста («из чего»), а слово Goodreads русскому
              рынку не говорит ничего. Заменили на «Топ ЛитРес · 24 650
              отзывов читателей» — обтекаемо, но конкретно.
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
