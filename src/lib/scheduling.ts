// Helpers de fuso horário America/Sao_Paulo (BRT, UTC-3 sem DST desde 2019)
// usados tanto pela UI quanto pela server function de agendamento.

const TZ = "America/Sao_Paulo";

export function brtParts(d: Date = new Date()): {
  ymd: string;
  hour: number;
  minute: number;
  weekday: number; // 0=Dom..6=Sáb
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    ymd,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: ymdToUtcDate(ymd).getUTCDay(),
  };
}

function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOfYmd(ymd: string): string {
  const dow = ymdToUtcDate(ymd).getUTCDay(); // 0..6
  const back = dow === 0 ? 6 : dow - 1;
  return addDaysYmd(ymd, -back);
}

/** Retorna os 5 dias úteis (Seg..Sex) da semana BRT atual + weekOffset. */
export function getWeekDays(weekOffset: number): string[] {
  const today = brtParts().ymd;
  const monday = addDaysYmd(mondayOfYmd(today), weekOffset * 7);
  return [0, 1, 2, 3, 4].map((i) => addDaysYmd(monday, i));
}

/** Pode editar o dia? Bloqueio com 24h de antecedência da entrega (11h BRT). */
export function isDayEditable(ymd: string, now: Date = new Date()): boolean {
  // Entrega às 11:00 BRT (= 14:00 UTC). Bloqueio começa 24h antes.
  const deliveryUtcMs = new Date(`${ymd}T14:00:00.000Z`).getTime();
  const cutoffMs = deliveryUtcMs - 24 * 60 * 60 * 1000;
  return now.getTime() < cutoffMs;
}

/** Quantidade mínima permitida por dia (além de 0 para cancelar). */
export const MIN_MEALS_PER_DAY = 3;

/** Converte YYYY-MM-DD em ISO UTC equivalente a 11:00 BRT. */
export function ymdToScheduledForIso(ymd: string): string {
  return `${ymd}T14:00:00.000Z`;
}

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatYmdShort(ymd: string): string {
  const d = ymdToUtcDate(ymd);
  const wd = WEEKDAY_LABEL[d.getUTCDay()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${wd}, ${dd}/${mm}`;
}

export function formatYmdRange(start: string, end: string): string {
  const s = ymdToUtcDate(start);
  const e = ymdToUtcDate(end);
  const f = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(
      d.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
  return `${f(s)} a ${f(e)}`;
}

export function isToday(ymd: string, now: Date = new Date()): boolean {
  return ymd === brtParts(now).ymd;
}
