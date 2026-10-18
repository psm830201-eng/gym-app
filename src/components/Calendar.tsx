import { useRef } from "react";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import type { Store } from "../types/workout";
import { dateKey, totals } from "../lib/workout";
interface Props {
  month: string;
  selected: string;
  store: Store;
  onMonth: (v: string) => void;
  onSelect: (v: string) => void;
  onCopy: (v: string) => void;
  hasClipboard: boolean;
  onPaste: () => void;
}
export function Calendar({
  month,
  selected,
  store,
  onMonth,
  onSelect,
  onCopy,
  hasClipboard,
  onPaste,
}: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    longPressed = useRef(false),
    origin = useRef({ x: 0, y: 0 });
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = new Date(`${month}-01T12:00:00`),
    offset = start.getDay(),
    last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(),
    today = dateKey();
  const move = (n: number) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    onMonth(dateKey(d).slice(0, 7));
  };
  return (
    <section className="calendar-card">
      <div className="panel-title">
        <h2>운동 달력</h2>
        <button
          className="plain-button"
          onClick={() => {
            onMonth(today.slice(0, 7));
            onSelect(today);
          }}
        >
          오늘
        </button>
      </div>
      <div className="month-control">
        <button
          className="icon-btn"
          aria-label="이전 달"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={19} />
        </button>
        <label className="sr-only" htmlFor="calendar-month">
          달력 월 선택
        </label>
        <input
          id="calendar-month"
          type="month"
          min="1900-01"
          max="2200-12"
          value={month}
          onChange={(e) => {
            if (/^\d{4}-\d{2}$/.test(e.target.value)) onMonth(e.target.value);
          }}
        />
        <button
          className="icon-btn"
          aria-label="다음 달"
          onClick={() => move(1)}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div className="weekdays">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: last }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, "0")}`,
            day = store.days[key],
            t = day ? totals(day) : { count: 0, done: 0 },
            has = t.count > 0;
          return (
            <button
              key={key}
              className={`calendar-day ${selected === key ? "selected" : ""} ${today === key ? "today" : ""} ${has ? "has-workout" : ""}`}
              aria-label={`${key}${has ? `, ${day.exercises.length}종목 ${t.done}/${t.count}세트` : ", 운동 없음"}`}
              title={
                has
                  ? `${day.exercises.map((e) => e.name).join(" · ")} / ${day.endedAt ? "세션 완료" : t.done ? "운동 중" : "계획"}`
                  : "운동 없음"
              }
              aria-pressed={selected === key}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                cancel();
                longPressed.current = false;
                origin.current = { x: e.clientX, y: e.clientY };
                timer.current = setTimeout(() => {
                  longPressed.current = true;
                  onSelect(key);
                  onCopy(key);
                  navigator.vibrate?.(35);
                }, 650);
              }}
              onPointerMove={(e) => {
                if (
                  Math.abs(e.clientX - origin.current.x) > 10 ||
                  Math.abs(e.clientY - origin.current.y) > 10
                )
                  cancel();
              }}
              onPointerUp={cancel}
              onPointerLeave={cancel}
              onPointerCancel={cancel}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (!longPressed.current) onSelect(key);
                longPressed.current = false;
              }}
            >
              <span>{i + 1}</span>
              <div
                className={`day-dot ${day?.endedAt ? "complete" : t.done ? "partial" : ""}`}
              >
                {has
                  ? day?.endedAt
                    ? "✓"
                    : `${day.exercises.length}종목`
                  : ""}
              </div>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="dot planned" />
          계획
        </span>
        <span>
          <i className="dot ongoing" />
          진행
        </span>
        <span>
          <i className="dot complete" />
          완료
        </span>
      </div>
      <p className="calendar-help">
        <Copy size={14} /> 날짜를 길게 누르면 하루 루틴 복사
      </p>
      {hasClipboard && (
        <button className="button outline full" onClick={onPaste}>
          선택한 날짜에 붙여넣기
        </button>
      )}
    </section>
  );
}
