"use client";

import { CONFIDENCE_ITEMS, CONFIDENCE_KEYS, type ConfidenceAnswers } from "@/lib/voice-practice/self-report";
import "./voice-practice.css";

export type ConfidenceDraft = Partial<ConfidenceAnswers>;

export function isConfidenceComplete(d: ConfidenceDraft): d is ConfidenceAnswers {
  return CONFIDENCE_KEYS.every((k) => typeof d[k] === "number");
}

/**
 * Три ползунка 0–10. Пока ползунок не тронут, значения нет («—»):
 * середина по умолчанию подсказывала бы ответ.
 */
export function ConfidenceSliders({ value, onChange }: { value: ConfidenceDraft; onChange: (v: ConfidenceDraft) => void }) {
  return (
    <div>
      {CONFIDENCE_ITEMS.map((text, i) => {
        const key = CONFIDENCE_KEYS[i];
        const v = value[key];
        const set = (raw: string) => onChange({ ...value, [key]: Number(raw) });
        return (
          <div key={key} className="vp-card vp-slider" data-untouched={v === undefined}>
            <label htmlFor={`conf-${key}`} className="vp-slider-label">
              <span>{text}</span>
              <b aria-hidden>{v ?? "—"}</b>
            </label>
            <input
              id={`conf-${key}`}
              type="range"
              min={0}
              max={10}
              step={1}
              value={v ?? 5}
              aria-valuetext={v === undefined ? "не отмечено" : String(v)}
              onChange={(e) => set(e.currentTarget.value)}
              // Касание середины не вызывает onChange — фиксируем значение и так.
              onPointerUp={(e) => set(e.currentTarget.value)}
              onKeyUp={(e) => set(e.currentTarget.value)}
            />
            <div className="vp-slider-scale">
              <span>0 — совсем не так</span>
              <span>10 — полностью так</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
