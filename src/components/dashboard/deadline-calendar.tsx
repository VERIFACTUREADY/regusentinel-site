import Link from "next/link";

interface DeadlineDay {
  date: string; // "YYYY-MM-DD"
  overdue: number;
  soon: number; // within 7 days
  future: number;
}

interface Props {
  days: DeadlineDay[];
  year: number;
  month: number;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function buildGrid(year: number, month: number): (number | null)[] {
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DeadlineCalendar({ days, year, month }: Props) {
  const grid = buildGrid(year, month);
  const today = new Date();
  const todayD = today.getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const byDay: Record<number, DeadlineDay> = {};
  for (const d of days) {
    const day = parseInt(d.date.slice(8, 10), 10);
    byDay[day] = d;
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm text-gray-900">
          Plazos — {MONTH_NAMES[month]} {year}
        </h2>
        <Link href="/calendar" className="text-xs text-primary hover:underline">
          Ver todo →
        </Link>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {grid.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="border-r border-b h-10 bg-gray-50/30" />;
          }

          const info = byDay[day];
          const isToday = isCurrentMonth && day === todayD;
          const hasOverdue = (info?.overdue ?? 0) > 0;
          const hasSoon = !hasOverdue && (info?.soon ?? 0) > 0;
          const hasFuture = !hasOverdue && !hasSoon && (info?.future ?? 0) > 0;

          const total = (info?.overdue ?? 0) + (info?.soon ?? 0) + (info?.future ?? 0);

          let bgClass = "";
          if (hasOverdue) bgClass = "bg-red-50";
          else if (hasSoon) bgClass = "bg-amber-50";
          else if (hasFuture) bgClass = "bg-blue-50";

          return (
            <Link
              key={day}
              href={`/calendar#${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
              className={`border-r border-b h-10 flex flex-col items-center justify-center gap-0.5 hover:bg-gray-100 transition ${bgClass}`}
            >
              <span
                className={`text-xs font-medium leading-none ${
                  isToday
                    ? "w-5 h-5 flex items-center justify-center bg-primary text-white rounded-full"
                    : total > 0 ? "text-gray-800" : "text-gray-500"
                }`}
              >
                {day}
              </span>
              {total > 0 && (
                <span
                  className={`text-[10px] font-semibold leading-none ${
                    hasOverdue ? "text-red-700" : hasSoon ? "text-amber-700" : "text-blue-700"
                  }`}
                >
                  {total}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick stats footer */}
      <div className="px-4 py-2.5 border-t bg-gray-50 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Vencidos", count: days.reduce((s, d) => s + d.overdue, 0), color: "text-red-700" },
          { label: "Esta semana", count: days.reduce((s, d) => s + d.soon, 0), color: "text-amber-700" },
          { label: "Este mes", count: days.reduce((s, d) => s + d.future, 0), color: "text-blue-700" },
        ].map(({ label, count, color }) => (
          <div key={label}>
            <div className={`text-sm font-bold ${color}`}>{count}</div>
            <div className="text-[10px] text-gray-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
