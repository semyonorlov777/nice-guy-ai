import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export function LandingFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div>
            <div className="footer-brand-logo">НеСлавный <span>AI</span></div>
            <div className="footer-brand-desc">Практика, которая меняет поведение.</div>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Продукт</div>
            <ul>
              <li><a href="#chat-block">Начать бесплатно</a></li>
              <li><a href="/auth">Войти в аккаунт</a></li>
              <li><a href={`/program/${DEFAULT_PROGRAM_SLUG}/test/issp`} target="_blank" rel="noopener noreferrer">Пройти тест</a></li>
              <li><a href="/balance" target="_blank" rel="noopener noreferrer">Тарифы и цены</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Юридическое</div>
            <ul>
              <li><a href="/legal" target="_blank" rel="noopener noreferrer">Оферта</a></li>
              <li><a href="/privacy" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a></li>
            </ul>
            <div className="legal-info">
              ИП Орлов Семён Вячеславович<br />
              ИНН 381914223321
            </div>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Контакты</div>
            <ul>
              <li><a href="https://t.me/semyonorlov" target="_blank" rel="noopener noreferrer">Telegram</a></li>
              <li><a href="mailto:dhorh@yandex.ru">dhorh@yandex.ru</a></li>
              <li><a href="tel:+79936004279">+7 993 600-42-79</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-payments">
            <span>МИР</span>
            <span>Visa</span>
            <span>Mastercard</span>
          </div>
          <div className="footer-copy">&copy; 2026 НеСлавный AI</div>
        </div>
      </div>
    </footer>
  );
}
