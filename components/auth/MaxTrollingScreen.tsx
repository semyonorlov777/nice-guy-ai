"use client";

import { useEffect, useRef, useState } from "react";

interface MaxTrollingScreenProps {
  onCancel: () => void;
}

function SealEmblem() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="36" fill="none" stroke="#b8860b" strokeWidth="2" />
      <circle cx="40" cy="40" r="30" fill="none" stroke="#b8860b" strokeWidth="1.2" />
      <text
        x="40"
        y="47"
        textAnchor="middle"
        fill="#b8860b"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="18"
        fontWeight="700"
        letterSpacing="2"
      >
        МАХ
      </text>
      <text x="13" y="45" fill="#b8860b" fontSize="10">★</text>
      <text x="59" y="45" fill="#b8860b" fontSize="10">★</text>
    </svg>
  );
}

export function MaxTrollingScreen({ onCancel }: MaxTrollingScreenProps) {
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber] = useState(() => Math.floor(100000 + Math.random() * 900000));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    timerRef.current = setTimeout(() => {
      onCancel();
    }, 3500);
  };

  if (submitted) {
    return (
      <div className="auth-sheet-max-screen">
        <div className="auth-sheet-max-emblem">
          <SealEmblem />
        </div>
        <h2 className="auth-sheet-max-title">Заявка принята к рассмотрению</h2>
        <p className="auth-sheet-max-preamble">
          Регистрационный номер вашего обращения:{" "}
          <strong>МАХ-{ticketNumber}/2026</strong>.
          <br />
          Решение о возможности предоставления доступа к сервису будет направлено
          вам почтой России в течение 14 (четырнадцати) рабочих дней с момента
          поступления полного комплекта документов. Не звоните нам — мы свяжемся
          с вами сами.
        </p>
        <p className="auth-sheet-max-fineprint">
          * Это, разумеется, троллинг. Никаких документов отправлять не нужно.
        </p>
        <button className="auth-sheet-max-back" onClick={onCancel}>
          ← Войти нормальным способом
        </button>
      </div>
    );
  }

  return (
    <div className="auth-sheet-max-screen">
      <div className="auth-sheet-max-emblem">
        <SealEmblem />
      </div>
      <h2 className="auth-sheet-max-title">
        Регистрация через государственный мессенджер MAX
      </h2>
      <p className="auth-sheet-max-preamble">
        В соответствии с Постановлением Правительства Российской Федерации
        № 1488 от 02.04.2026 «О единой защищённой цифровой коммуникационной
        платформе для граждан Российской Федерации», регистрация пользователей
        в системе MAX осуществляется при предоставлении следующего пакета
        документов:
      </p>
      <ol className="auth-sheet-max-requirements">
        <li>
          Подтверждённая учётная запись на портале «Госуслуги» (категория III —
          с биометрической верификацией в отделении МФЦ).
        </li>
        <li>СНИЛС.</li>
        <li>
          Скан паспорта гражданина РФ (страницы 2–3, 5, 14, 18–19) в формате
          PDF/A, разрешение не ниже 600 dpi.
        </li>
        <li>
          ИНН и справка по форме 2-НДФЛ за последние 5 (пять) полных налоговых
          периодов.
        </li>
        <li>
          Нотариально заверенное согласие на обработку персональных данных в
          соответствии с ФЗ-152.
        </li>
        <li>Справка об отсутствии двойного гражданства (форма ФМС-2).</li>
        <li>Справка о составе семьи (форма №9 по месту регистрации).</li>
        <li>
          Биометрические данные: дактилоскопическая карта (отпечатки всех 10
          пальцев) и сканы радужной оболочки обоих глаз.
        </li>
        <li>
          Письмо-обоснование необходимости использования мессенджера (свободная
          форма, объём не менее 1500 знаков с пробелами).
        </li>
        <li>
          <strong>
            Иностранная SIM-карта и активный VPN-сервис
          </strong>{" "}
          — для верификации отсутствия использования сервиса в санкционных
          юрисдикциях.
        </li>
      </ol>
      <p className="auth-sheet-max-instructions">
        Полный пакет документов направляйте на контактный электронный адрес,
        указанный в шапке сервиса. Срок рассмотрения заявки — 14 (четырнадцать)
        рабочих дней с момента получения полного комплекта. Срок может быть
        продлён в соответствии с пп. 3.4 регламента.
      </p>
      <button
        type="button"
        className="auth-sheet-max-cta"
        onClick={handleSubmit}
      >
        Продолжить регистрацию
      </button>
      <p className="auth-sheet-max-fineprint">
        * Это, разумеется, троллинг. Никаких документов отправлять не нужно.
      </p>
      <button
        type="button"
        className="auth-sheet-max-back"
        onClick={onCancel}
      >
        ← Войти нормальным способом
      </button>
    </div>
  );
}
