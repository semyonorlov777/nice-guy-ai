"use client";

// Круг звонка и «меня слышат?» — общий для звонка и разминки.
// Клиент говорит — круг светится (data-speaking). Студент говорит — тонкое кольцо вокруг круга
// дышит в такт голосу: громкость берётся прямо с микрофона, без задержки сети. Под кругом —
// знак, доходит ли звук до сервера: «Вас слышно» (подтверждения идут), «Связь прервалась»,
// «Микрофон не передаёт звук», «Дослушайте» (микрофон ждёт, пока клиент договорит).
import { useEffect, useRef } from "react";
import type { MicLink } from "@/hooks/useVoiceSession";

/** Связь прервалась: что делать студенту. «Знак» — надпись «Вас слышно» под кругом. */
export const LOST_TEXT = "Восстанавливаем связь. Договорите, когда снова появится «Вас слышно».";
export const NOMIC_TEXT = "Звук с микрофона не идёт. Проверьте, что он включён и выбран в браузере.";
export const REPEAT_TEXT = "Вас снова слышно. Последние слова могли не дойти — повторите их коротко.";

export function VoiceOrb(props: {
  speaking: "client" | "student" | "idle";
  /** null — разговор ещё не идёт: только круг, без кольца и знака. */
  link: MicLink | null;
  heard: boolean;
  micLevel: () => number;
}) {
  const { link, micLevel } = props;
  const wrapRef = useRef<HTMLDivElement>(null);

  // Кольцо живёт в кадре анимации: громкость пишется в CSS-переменную, без перерисовки React.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || link !== "ok") {
      el?.style.setProperty("--vp-lvl", "0");
      return;
    }
    let raf = 0;
    let lvl = 0;
    const loop = () => {
      const v = micLevel();
      // Быстрый подъём, плавный спад — кольцо не дрожит между слогами.
      lvl = v > lvl ? lvl + (v - lvl) * 0.6 : lvl * 0.88;
      el.style.setProperty("--vp-lvl", lvl.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [link, micLevel]);

  const sign =
    link === "lost"
      ? "Связь прервалась"
      : link === "nomic"
        ? "Микрофон не передаёт звук"
        : link === "muted"
        ? "Дослушайте — микрофон включится сам"
        : link === "ok"
          ? "Вас слышно"
          : null;

  return (
    <div className="vp-voice">
      <div ref={wrapRef} className="vp-orb-wrap" data-link={link ?? "none"}>
        <div className="vp-mic-ring" aria-hidden />
        <div className="vp-orb" data-speaking={props.speaking} aria-hidden />
      </div>
      <p className="vp-sign" data-link={link ?? "none"} data-heard={props.heard} aria-live="polite">
        {sign && (
          <>
            <span className="vp-sign-dot" aria-hidden />
            {sign}
          </>
        )}
      </p>
    </div>
  );
}
