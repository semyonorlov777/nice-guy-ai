import Link from "next/link";

interface SiteFooterProps {
  variant?: "program" | "default";
}

export function SiteFooter({ variant = "default" }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div>
            <div className="footer-brand-logo">Книжный <span>Спарринг</span></div>
            <div className="footer-brand-desc">Практика, которая меняет поведение.</div>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Продукт</div>
            <ul>
              <li>
                {variant === "program" ? (
                  // Якорь на той же странице — обычный <a>, не <Link>
                  <a href="#chat-block">Начать бесплатно</a>
                ) : (
                  <Link href="/">Главная</Link>
                )}
              </li>
              <li><Link href="/auth">Войти в аккаунт</Link></li>
              <li><Link href="/tests">Все тесты</Link></li>
              <li><Link href="/balance" target="_blank" rel="noopener noreferrer">Тарифы и цены</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Юридическое</div>
            <ul>
              <li><Link href="/legal" target="_blank" rel="noopener noreferrer">Оферта</Link></li>
              <li><Link href="/privacy" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</Link></li>
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
          <div className="footer-copy">&copy; 2026 Книжный Спарринг</div>
        </div>
      </div>
    </footer>
  );
}
