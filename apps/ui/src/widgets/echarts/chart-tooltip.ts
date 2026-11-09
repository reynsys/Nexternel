/**
 * Every chart's pop-up (touching or pointing at a moment on a chart):
 * - it stays inside its own chart, at the top, beside the finger, so it never lands on other panels or
 *   under the dashboards row at the bottom of a phone (it used to be placed on the page itself, which put
 *   it below lower charts);
 * - the value is written as the chart's own axis writes it (same unit, e.g. "0.017 kW"), with a short time.
 */
type AxisLabel = { formatter?: unknown };
type ParamsItem = { axisValue?: unknown; value?: unknown; seriesName?: string; marker?: string };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function axisFormatter(option: Record<string, unknown>): ((v: number) => string) | null {
  const y = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis;
  const f = (y as { axisLabel?: AxisLabel } | undefined)?.axisLabel?.formatter;
  return typeof f === "function" ? (v: number) => String((f as (v: number) => unknown)(v)) : null;
}

function isTimeAxis(option: Record<string, unknown>): boolean {
  const x = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis;
  return (x as { type?: string } | undefined)?.type === "time";
}

function shortTime(ms: number): string {
  const d = new Date(ms);
  // Today: the time only. Another day: its name too ("Sun 23:48"), so yesterday evening is not read as tonight.
  const today = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(undefined, today ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

/** At the top of the chart, centred on the finger but never past the chart's sides. */
function placeAtTop(point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: { contentSize: number[]; viewSize: number[] }) {
  const [w] = size.contentSize;
  const [viewW] = size.viewSize;
  const x = Math.min(Math.max(4, point[0]! - w / 2), Math.max(4, viewW - w - 4));
  return [x, 4];
}

export function applySafeChartTooltip(option: Record<string, unknown>): Record<string, unknown> {
  const tooltip = option.tooltip;
  const base =
    tooltip && typeof tooltip === "object" && !Array.isArray(tooltip)
      ? (tooltip as Record<string, unknown>)
      : {};
  const fmt = axisFormatter(option);
  const ownWords =
    base.trigger === "axis" && !base.formatter && isTimeAxis(option)
      ? {
          formatter: (params: ParamsItem | ParamsItem[]) => {
            const list = Array.isArray(params) ? params : [params];
            const first = list[0];
            const when = Array.isArray(first?.value) ? first.value[0] : first?.axisValue;
            const at = typeof when === "number" ? when : Date.parse(String(when));
            const lines = list.map((p) => {
              const raw = Array.isArray(p.value) ? Number(p.value[1]) : Number(p.value);
              const shown = Number.isFinite(raw) ? (fmt ? fmt(raw) : String(raw)) : "—";
              return `${p.marker ?? ""}${escape(p.seriesName ?? "")} <b>${escape(shown)}</b>`;
            });
            return `${Number.isFinite(at) ? `<div>${escape(shortTime(at))}</div>` : ""}${lines.join("<br/>")}`;
          },
        }
      : fmt && !base.valueFormatter
        ? { valueFormatter: (v: unknown) => (typeof v === "number" ? fmt(v) : String(v ?? "")) }
        : {};
  return {
    ...option,
    tooltip: {
      ...base,
      ...ownWords,
      confine: true,
      appendToBody: false,
      ...(base.position ? {} : { position: placeAtTop }),
    },
  };
}
