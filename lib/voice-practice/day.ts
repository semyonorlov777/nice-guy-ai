/** Учебный день практикума — по Москве (граница квоты и самоотчётов). */
export function practiceDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(now);
}
