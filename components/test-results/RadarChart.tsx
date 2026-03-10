"use client";

import { ISSP_SCALE_ORDER } from "@/lib/issp-config";
import type { ScaleResult } from "@/lib/issp-scoring";
import { useScrollReveal } from "./useScrollReveal";

const CX = 250;
const CY = 250;
const MAX_R = 185;
const N = 7;

const RADAR_LABELS: Record<string, string[]> = {
  approval: ["Потребность", "в одобрении"],
  contracts: ["Скрытые", "контракты"],
  suppression: ["Подавление", "потребностей"],
  control: ["Контроль", "и стратегии"],
  boundaries: ["Сложности", "с границами"],
  masculinity: ["Мужская", "идентичность"],
  attachment: ["Отношения и", "привязанность"],
};

function polarToCart(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function makePolygonPoints(radius: number): string {
  return ISSP_SCALE_ORDER.map((_, i) => {
    const angle = (360 / N) * i;
    const p = polarToCart(angle, radius);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function dotColor(pct: number): string {
  if (pct >= 60) return "var(--tr-red)";
  if (pct >= 40) return "var(--tr-yellow)";
  return "var(--tr-green)";
}

interface RadarChartProps {
  scoresByScale: Record<string, ScaleResult>;
}

export function RadarChart({ scoresByScale }: RadarChartProps) {
  const { ref, isVisible } = useScrollReveal(0.1);

  const dataPoints = ISSP_SCALE_ORDER.map((key, i) => {
    const pct = scoresByScale[key]?.pct ?? 0;
    const angle = (360 / N) * i;
    const r = MAX_R * (pct / 100);
    return polarToCart(angle, r);
  });

  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      ref={ref}
      className={`tr-radar-section tr-section-anim${isVisible ? " visible" : ""}`}
    >
      <div className="tr-section-label">Ваш профиль</div>
      <div className="tr-section-title">Ваши 7 шкал</div>

      <div className="tr-radar-wrapper">
        <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="areaGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(92, 184, 122, 0.05)" />
              <stop offset="40%" stopColor="rgba(201, 168, 76, 0.12)" />
              <stop offset="100%" stopColor="rgba(199, 80, 80, 0.18)" />
            </radialGradient>
            <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(92, 184, 122, 0.03)" />
              <stop offset="50%" stopColor="rgba(201, 168, 76, 0.02)" />
              <stop offset="100%" stopColor="rgba(199, 80, 80, 0.03)" />
            </radialGradient>
          </defs>

          {/* Background */}
          <circle cx={CX} cy={CY} r={MAX_R} fill="url(#bgGradient)" />

          {/* Grid rings */}
          <polygon className="tr-radar-grid-line" points={makePolygonPoints(MAX_R)} />
          <polygon className="tr-radar-grid-line" points={makePolygonPoints(MAX_R * 0.75)} />
          <polygon className="tr-radar-grid-line-accent" points={makePolygonPoints(MAX_R * 0.5)} />
          <polygon className="tr-radar-grid-line" points={makePolygonPoints(MAX_R * 0.25)} />

          {/* Zone labels */}
          <text x={CX} y={108} textAnchor="middle" fill="#c75050" fontFamily="var(--font-onest), Onest, sans-serif" fontSize={9} fontWeight={600} opacity={0.5}>ВЫСОКИЙ</text>
          <text x={CX} y={155} textAnchor="middle" fill="#d4a843" fontFamily="var(--font-onest), Onest, sans-serif" fontSize={9} fontWeight={600} opacity={0.4}>СРЕДНИЙ</text>
          <text x={CX} y={202} textAnchor="middle" fill="#5cb87a" fontFamily="var(--font-onest), Onest, sans-serif" fontSize={9} fontWeight={600} opacity={0.4}>НИЗКИЙ</text>

          {/* Axis lines */}
          {ISSP_SCALE_ORDER.map((_, i) => {
            const angle = (360 / N) * i;
            const p = polarToCart(angle, MAX_R);
            return (
              <line
                key={`axis-${i}`}
                className="tr-radar-axis"
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
              />
            );
          })}

          {/* Data area */}
          <polygon
            className="tr-radar-area"
            points={dataPolygon}
            fill="url(#areaGradient)"
            stroke="var(--tr-gold)"
            strokeWidth={2}
          />

          {/* Data dots */}
          {ISSP_SCALE_ORDER.map((key, i) => {
            const pct = scoresByScale[key]?.pct ?? 0;
            return (
              <circle
                key={`dot-${i}`}
                className="tr-radar-dot"
                cx={dataPoints[i].x}
                cy={dataPoints[i].y}
                r={5}
                fill={dotColor(pct)}
                stroke="var(--tr-bg)"
                strokeWidth={2}
              />
            );
          })}

          {/* Labels */}
          {ISSP_SCALE_ORDER.map((key, i) => {
            const pct = scoresByScale[key]?.pct ?? 0;
            const angle = (360 / N) * i;
            const lp = polarToCart(angle, MAX_R + 32);
            const lines = RADAR_LABELS[key] || [key];

            return (
              <g key={`label-${i}`}>
                {lines.map((line, li) => (
                  <text
                    key={li}
                    className="tr-radar-label-text"
                    x={lp.x}
                    y={lp.y - (lines.length - 1) * 7 + li * 14}
                    textAnchor="middle"
                  >
                    {line}
                  </text>
                ))}
                <text
                  className="tr-radar-value-text"
                  x={lp.x}
                  y={lp.y + lines.length * 7 + 6}
                  textAnchor="middle"
                  fill={dotColor(pct)}
                >
                  {pct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
