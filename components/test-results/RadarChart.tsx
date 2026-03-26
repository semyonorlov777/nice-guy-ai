"use client";

import { ISSP_SCALE_ORDER } from "@/lib/issp-config";
import type { ScaleResult } from "@/lib/issp-scoring";
import { useScrollReveal } from "./useScrollReveal";

/* SVG <stop stopColor> doesn't support CSS custom properties or color-mix(),
   so we use hardcoded rgba aligned with global design-system tokens:
   green → --green (#6AAE6A dark), accent → --accent (#D4A545 dark), danger → --danger (#D46B6B dark) */
const RADAR_GRADIENT_STOPS = {
  area: [
    { offset: "0%",   color: "rgba(106, 174, 106, 0.05)" },   // --green
    { offset: "40%",  color: "rgba(212, 165, 69, 0.12)" },     // --accent
    { offset: "100%", color: "rgba(212, 107, 107, 0.18)" },    // --danger
  ],
  bg: [
    { offset: "0%",   color: "rgba(106, 174, 106, 0.03)" },   // --green
    { offset: "50%",  color: "rgba(212, 165, 69, 0.02)" },     // --accent
    { offset: "100%", color: "rgba(212, 107, 107, 0.03)" },    // --danger
  ],
} as const;

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
  if (pct >= 60) return "var(--danger)";
  if (pct >= 40) return "var(--accent)";
  return "var(--green)";
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
      <div className="tr-section-title">Где это проявляется</div>

      <div className="tr-radar-wrapper">
        <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="areaGradient" cx="50%" cy="50%" r="50%">
              {RADAR_GRADIENT_STOPS.area.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </radialGradient>
            <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%">
              {RADAR_GRADIENT_STOPS.bg.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
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
          <text x={CX} y={108} textAnchor="middle" fill="var(--danger)" fontFamily="var(--font-body)" fontSize={9} fontWeight={600} opacity={0.5}>ВЫСОКИЙ</text>
          <text x={CX} y={155} textAnchor="middle" fill="var(--accent)" fontFamily="var(--font-body)" fontSize={9} fontWeight={600} opacity={0.4}>СРЕДНИЙ</text>
          <text x={CX} y={202} textAnchor="middle" fill="var(--green)" fontFamily="var(--font-body)" fontSize={9} fontWeight={600} opacity={0.4}>НИЗКИЙ</text>

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
            stroke="var(--accent)"
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
                stroke="var(--bg-main)"
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
