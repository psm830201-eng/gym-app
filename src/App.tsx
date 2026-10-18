import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  Dumbbell,
  FileText,
  Library,
  Plus,
  RotateCcw,
  Settings2,
  Timer,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Day, Exercise, Store, WorkoutExercise } from "./types/workout";
import { Calendar } from "./components/Calendar";
import { Modal } from "./components/Modal";
import { NumberInput } from "./components/NumberInput";
import { WorkoutCard } from "./components/WorkoutCard";
import { ExerciseLibrary } from "./components/ExerciseLibrary";
import {
  STORAGE_KEY,
  cloneRoutine,
  clock,
  dateKey,
  elapsed,
  emptyDay,
  loadStore,
  makeExercise,
  parseStore,
  pairExercises,
  recordSet,
  sessionText,
  shortDate,
  starterRoutine,
  totals,
  uid,
} from "./lib/workout";

function download(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const initial = loadStore();
const initialDate =
  Object.entries(initial.store.days).find(
    ([, d]) => d.startedAt && !d.endedAt,
  )?.[0] ?? dateKey();
type Dialog =
  "picker" | "save" | "load" | "export" | "settings" | "superset" | null;
export default function App() {
  const [store, setStore] = useState<Store>(initial.store),
    storeRef = useRef(store);
  const [saveError, setSaveError] = useState(initial.error),
    [storageAllowed, setStorageAllowed] = useState(!initial.error);
  const [selected, setSelected] = useState(initialDate),
    [month, setMonth] = useState(initialDate.slice(0, 7)),
    [tab, setTab] = useState<"calendar" | "library" | "templates">("calendar");
  const [dialog, setDialog] = useState<Dialog>(null),
    [now, setNow] = useState(Date.now()),
    [clipboard, setClipboard] = useState<WorkoutExercise[] | null>(null),
    [copiedFrom, setCopiedFrom] = useState(""),
    [toast, setToast] = useState(""),
    [templateName, setTemplateName] = useState(""),
    [timerNotice, setTimerNotice] = useState(false),
    [pairSource, setPairSource] = useState<WorkoutExercise | null>(null);
  const audioRef = useRef<AudioContext | null>(null),
    oscillators = useRef<OscillatorNode[]>([]),
    importRef = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = store.days[selected] ?? emptyDay(),
    t = totals(current),
    activeDate = Object.keys(store.days).find(
      (d) => store.days[d].startedAt && !store.days[d].endedAt,
    );
  const editable = !current.startedAt,
    locked = !!current.endedAt;
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  const commit = (change: (next: Store) => void) => {
    const next = structuredClone(storeRef.current);
    change(next);
    storeRef.current = next;
    setStore(next);
  };
  const updateDay = (change: (day: Day) => void) =>
    commit((next) => {
      next.days[selected] ??= emptyDay();
      change(next.days[selected]);
    });
  useEffect(() => {
    if (!storageAllowed) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      setSaveError(null);
    } catch {
      setSaveError(
        "기기에 저장하지 못했어요. 저장 공간·브라우저 설정을 확인하고 JSON 백업을 내려받아 주세요. 현재 변경은 이 화면에만 남아 있어요.",
      );
    }
  }, [store, storageAllowed]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const stopSound = () => {
    oscillators.current.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
    oscillators.current = [];
  };
  const unlockSound = async () => {
    try {
      audioRef.current ??= new AudioContext();
      if (audioRef.current.state === "suspended")
        await audioRef.current.resume();
      return audioRef.current.state === "running";
    } catch {
      notify(
        "이 브라우저에서 소리를 사용할 수 없어요. 화면 알림을 확인해 주세요.",
      );
      return false;
    }
  };
  const ring = () => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== "running") {
      notify(
        "휴식이 끝났어요! 소리를 켜려면 설정의 소리 테스트를 눌러 주세요.",
      );
      return;
    }
    stopSound();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(),
        g = ctx.createGain(),
        start = ctx.currentTime + i * 0.7;
      o.type = "sine";
      o.frequency.setValueAtTime(880, start);
      o.frequency.exponentialRampToValueAtTime(440, start + 0.45);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.28, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.65);
      oscillators.current.push(o);
    }
  };
  useEffect(() => {
    if (store.rest && now >= store.rest.endAt) {
      commit((next) => {
        next.rest = null;
      });
      setTimerNotice(true);
      notify("휴식이 끝났어요! 다음 세트를 시작해 주세요.");
      if (store.settings.sound) ring();
      navigator.vibrate?.([180, 100, 180, 100, 180]);
    }
  }, [now, store.rest]); // Check absolute deadline, including after tab suspension.
  useEffect(
    () => () => {
      stopSound();
      void audioRef.current?.close();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const startRest = (seconds: number) => {
    stopSound();
    setTimerNotice(false);
    if (seconds <= 0) {
      commit((next) => {
        next.rest = null;
      });
      return;
    }
    stopSound();
    setTimerNotice(false);
    commit((next) => {
      next.rest = {
        endAt: Date.now() + seconds * 1000,
        duration: seconds,
        date: selected,
      };
    });
  };
  const cancelRest = () => {
    stopSound();
    commit((next) => {
      next.rest = null;
    });
    setTimerNotice(false);
  };
  const selectDate = (key: string) => {
    setSelected(key);
    setMonth(key.slice(0, 7));
  };
  const copyDay = (key = selected) => {
    const d = storeRef.current.days[key];
    if (!d?.exercises.length) {
      notify("복사할 루틴이 없어요. 먼저 운동을 추가해 주세요.");
      return;
    }
    setClipboard(cloneRoutine(d.exercises));
    setCopiedFrom(key);
    notify(
      `${shortDate(key)} 루틴을 복사했어요. 다른 날짜를 선택해 붙여넣으세요.`,
    );
  };
  const applyRoutine = (exercises: WorkoutExercise[]) => {
    if (!editable) {
      notify(
        "시작한 기록에는 루틴을 덮어쓸 수 없어요. 기록을 초기화하거나 다른 날짜를 선택해 주세요.",
      );
      return;
    }
    if (
      current.exercises.length &&
      !confirm("이 날짜의 기존 계획을 선택한 루틴으로 교체할까요?")
    )
      return;
    updateDay((d) => {
      d.exercises = cloneRoutine(exercises);
    });
    setDialog(null);
    setTab("calendar");
    notify("루틴을 불러왔어요. 무게와 횟수를 조정해 보세요.");
  };
  const addExercise = (exercise: Exercise) => {
    const d = storeRef.current.days[selected];
    if (d?.endedAt) {
      notify("완료 기록은 보호되어 있어요. 다른 날짜에 추가해 주세요.");
      return;
    }
    if ((d?.exercises.length ?? 0) >= 100) {
      notify("하루에는 100종목까지 추가할 수 있어요.");
      return;
    }
    updateDay((day) => {
      day.exercises.push(
        makeExercise(exercise, storeRef.current.settings.restSeconds),
      );
    });
    notify(`${exercise.name} 추가 완료`);
  };
  const startSession = () => {
    const latest = storeRef.current.days[selected];
    if (!latest?.exercises.length) {
      notify("운동을 먼저 추가해 주세요.");
      return;
    }
    if (latest.startedAt) return;
    if (
      Object.entries(storeRef.current.days).some(
        ([key, d]) => key !== selected && d.startedAt && !d.endedAt,
      )
    ) {
      notify("진행 중인 다른 날짜의 운동을 먼저 종료해 주세요.");
      return;
    }
    cancelRest();
    updateDay((d) => {
      d.startedAt = Date.now();
      d.endedAt = null;
      d.activeSetId = null;
    });
    void unlockSound();
    notify("전체 운동 시작! 세트를 마친 뒤 휴식을 눌러 주세요.");
  };
  const completeSet = (exercise: WorkoutExercise, index: number) => {
    try {
      let result = { rest: false, seconds: 0 };
      updateDay((d) => {
        result = recordSet(d, exercise.id, index, Date.now());
      });
      if (result.rest) {
        void unlockSound();
        startRest(result.seconds);
      } else {
        cancelRest();
        notify(
          "첫 종목 완료! 같은 라운드의 짝 운동까지 마친 뒤 휴식을 눌러 주세요.",
        );
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "세트를 기록하지 못했어요.",
      );
    }
  };
  const undoSet = (exercise: WorkoutExercise, index: number) => {
    updateDay((d) => {
      d.exercises.find((e) => e.id === exercise.id)!.sets[index].doneAt = null;
    });
    if (storeRef.current.rest?.date === selected) cancelRest();
    notify("세트 완료 표시를 취소했어요.");
  };
  const resetDay = () => {
    if (
      !confirm(
        "이 날짜의 완료 표시와 운동시간을 초기화할까요? 운동 계획과 메모는 유지해요.",
      )
    )
      return;
    updateDay((d) => {
      d.startedAt = null;
      d.endedAt = null;
      d.activeSetId = null;
      d.exercises.forEach((e) =>
        e.sets.forEach((s) => {
          s.doneAt = null;
        }),
      );
    });
    if (store.rest?.date === selected) cancelRest();
    notify("진행 기록을 초기화했어요.");
  };
  const finishSession = () => {
    const d = storeRef.current.days[selected];
    if (!d?.startedAt || d.endedAt) return;
    const unfinished = totals(d).done < totals(d).count;
    if (
      !confirm(
        unfinished
          ? "전체 운동을 종료할까요? 남은 세트는 미완료로 보관하고 지금 시각으로 종료해요."
          : "전체 운동을 종료하고 지금까지의 기록을 저장할까요?",
      )
    )
      return;
    updateDay((day) => {
      day.endedAt = Date.now();
      day.activeSetId = null;
    });
    cancelRest();
    notify("전체 운동을 종료하고 운동시간을 저장했어요.");
  };
  const saveTemplate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateName.trim()) return;
    if (store.templates.length >= 10) {
      notify(
        "루틴은 10개까지 저장할 수 있어요. 기존 루틴을 삭제한 뒤 다시 저장해 주세요.",
      );
      return;
    }
    commit((next) => {
      next.templates.push({
        id: uid(),
        name: templateName.trim(),
        exercises: cloneRoutine(current.exercises),
      });
    });
    setDialog(null);
    setTemplateName("");
    notify("내 루틴에 저장했어요.");
  };
  const deleteCustom = (id: string) => {
    if (
      confirm(
        "운동 목록에서 삭제할까요? 이미 기록한 운동과 저장 루틴에는 영향을 주지 않아요.",
      )
    )
      commit((next) => {
        next.customExercises = next.customExercises.filter((e) => e.id !== id);
      });
  };
  const addCustom = (e: Exercise) => {
    commit((next) => {
      next.customExercises.push(e);
    });
    notify("커스텀 운동을 저장했어요. 목록의 + 버튼으로 날짜에 추가해 주세요.");
  };
  const restore = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      notify("5MB 이하의 JSON 백업 파일을 선택해 주세요.");
      return;
    }
    try {
      const restored = parseStore(await file.text());
      if (
        !confirm(
          "백업으로 모든 현재 기록과 루틴을 교체할까요? 먼저 현재 기록을 백업하는 것을 권장해요.",
        )
      )
        return;
      stopSound();
      restored.rest = null;
      storeRef.current = restored;
      setStore(restored);
      setStorageAllowed(true);
      setDialog(null);
      notify("백업을 복원했어요. 진행 중이던 세션도 이어서 기록할 수 있어요.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "백업을 읽을 수 없어요.");
    }
  };
  const monthDays = Object.entries(store.days).filter(([key]) =>
      key.startsWith(month),
    ),
    completedDays = monthDays.filter(([, d]) => d.endedAt).length,
    monthlySets = monthDays.reduce((n, [, d]) => n + totals(d).done, 0);
  const remaining = store.rest
    ? Math.max(0, Math.ceil((store.rest.endAt - now) / 1000))
    : 0;
  const templatesContent = (
    <>
      <div className="template-heading">
        <p>
          운동 순서·세트·무게·시간·휴식 설정을 함께 저장해요.
          <br />
          불러올 때 완료 표시와 운동시간은 새로 시작해요.
        </p>
        <span className="pill">{store.templates.length} / 10</span>
      </div>
      {store.templates.length === 0 ? (
        <div className="empty-small">
          아직 저장한 루틴이 없어요. 날짜에 운동을 추가한 뒤 ‘루틴 저장’을 눌러
          보세요.
        </div>
      ) : (
        <div className="template-list">
          {store.templates.map((template) => (
            <article className="template-item" key={template.id}>
              <span className="template-symbol">
                <Bookmark size={21} />
              </span>
              <div>
                <h3>{template.name}</h3>
                <p>
                  {template.exercises.length}종목 ·{" "}
                  {template.exercises.reduce((n, e) => n + e.sets.length, 0)}
                  세트
                </p>
                <small>
                  {template.exercises.map((e) => e.name).join(" · ")}
                </small>
              </div>
              <button
                className="button outline"
                onClick={() => applyRoutine(template.exercises)}
              >
                불러오기
              </button>
              <button
                className="icon-btn danger"
                aria-label={`${template.name} 루틴 삭제`}
                onClick={() => {
                  if (confirm(`‘${template.name}’ 루틴을 삭제할까요?`))
                    commit((next) => {
                      next.templates = next.templates.filter(
                        (t) => t.id !== template.id,
                      );
                    });
                }}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
      <h3 className="starter-heading">처음이라면, 이 루틴으로</h3>
      <div className="starter-grid">
        {(
          [
            { id: "full", name: "가볍게 전신", desc: "맨몸 + 덤벨 · 4종목" },
            {
              id: "upper",
              name: "덤벨 상체",
              desc: "가슴 + 어깨 + 팔 · 3종목",
            },
            {
              id: "cardio",
              name: "유산소 & 회복",
              desc: "걷기 + 사이클 + 스트레칭",
            },
          ] as const
        ).map((p) => (
          <button
            className="starter-item"
            key={p.id}
            onClick={() =>
              applyRoutine(starterRoutine(p.id, store.settings.restSeconds))
            }
          >
            <Dumbbell size={22} />
            <strong>{p.name}</strong>
            <span>{p.desc}</span>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
      <p className="help-text">
        예시 루틴은 출발점이에요. 무게·횟수·시간을 내 체력에 맞게 조절해 주세요.
      </p>
    </>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("calendar");
          }}
        >
          <span className="brand-icon">
            <Activity size={23} />
          </span>
          오운<span className="brand-tagline">오늘의 움직임</span>
        </a>
        <nav aria-label="메인 메뉴">
          {(
            [
              { id: "calendar", icon: CalendarDays, name: "운동 기록" },
              { id: "library", icon: Library, name: "운동 도서관" },
              { id: "templates", icon: Bookmark, name: "내 루틴" },
            ] as const
          ).map(({ id, icon: Icon, name }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={17} />
              {name}
              {id === "templates" && (
                <span className="nav-count">{store.templates.length}</span>
              )}
            </button>
          ))}
        </nav>
        <button
          className="settings-button"
          aria-label="설정과 백업"
          onClick={() => setDialog("settings")}
        >
          <Settings2 size={19} />
          <span>설정</span>
        </button>
      </header>
      <main className="dashboard">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="status-dot" /> YOUR DAILY MOVEMENT
            </div>
            <h1>
              {tab === "calendar"
                ? "오늘의 움직임을 쌓아가요."
                : tab === "library"
                  ? "나에게 맞는 운동을 찾아요."
                  : "좋은 루틴은, 다시 꺼내 써요."}
            </h1>
            <p>
              {tab === "calendar"
                ? "작은 기록이 모여, 나만의 꾸준함이 됩니다."
                : tab === "library"
                  ? "맨몸부터 덤벨까지. 원하는 운동을 고르거나 직접 만들어 보세요."
                  : "자주 하는 하루 루틴을 최대 10개까지 간편하게 저장하세요."}
            </p>
          </div>
          <div className="local-badge">
            <span className={`status-dot ${saveError ? "warning" : ""}`} />
            {saveError ? "저장 확인 필요" : "이 기기에 자동 저장"}
            <small>별도 가입 없이, 나만의 운동 기록</small>
          </div>
        </div>
        {saveError && (
          <div className="error-banner" role="alert">
            <p>{saveError}</p>
            <button
              onClick={() =>
                download(
                  `오운-백업-${dateKey()}.json`,
                  JSON.stringify(store, null, 2),
                  "application/json",
                )
              }
              className="button outline"
            >
              현재 화면 백업
            </button>
            {!storageAllowed && (
              <button
                className="button outline"
                onClick={() => {
                  if (
                    confirm(
                      "기존 저장 데이터를 현재 화면의 기록으로 덮어쓸까요?",
                    )
                  )
                    setStorageAllowed(true);
                }}
              >
                현재 기록 저장 허용
              </button>
            )}
          </div>
        )}
        {activeDate && activeDate !== selected && (
          <button
            className="active-session-banner"
            onClick={() => {
              selectDate(activeDate);
              setTab("calendar");
            }}
          >
            <Activity size={18} />
            {shortDate(activeDate)} 운동이 진행 중이에요. 기록 이어가기
            <ArrowRight size={17} />
          </button>
        )}
        {tab === "calendar" ? (
          <>
            <section className="month-summary" aria-label="월간 운동 요약">
              <div>
                <span className="summary-icon">
                  <CalendarDays size={20} />
                </span>
                <span>
                  <small>{Number(month.slice(5))}월 운동한 날</small>
                  <strong>
                    {monthDays.filter(([, d]) => totals(d).done > 0).length}
                    <em>일</em>
                  </strong>
                </span>
              </div>
              <div>
                <span className="summary-icon">
                  <CheckCheck size={20} />
                </span>
                <span>
                  <small>완료한 세션</small>
                  <strong>
                    {completedDays}
                    <em>회</em>
                  </strong>
                </span>
              </div>
              <div>
                <span className="summary-icon">
                  <Dumbbell size={20} />
                </span>
                <span>
                  <small>완료한 세트</small>
                  <strong>
                    {monthlySets}
                    <em>세트</em>
                  </strong>
                </span>
              </div>
              <p>
                어제보다 한 걸음,
                <br />
                <b>나만의 페이스로.</b>
                <span>
                  <ArrowUpRight size={36} strokeWidth={1} />
                </span>
              </p>
            </section>
            <div className="workspace">
              <aside className="calendar-column">
                <Calendar
                  month={month}
                  selected={selected}
                  store={store}
                  onMonth={setMonth}
                  onSelect={setSelected}
                  onCopy={copyDay}
                  hasClipboard={!!clipboard}
                  onPaste={() => clipboard && applyRoutine(clipboard)}
                />
                {clipboard && (
                  <div className="clipboard-card">
                    <Clipboard size={18} />
                    <div>
                      <strong>복사한 루틴</strong>
                      <p>
                        {shortDate(copiedFrom)} · {clipboard.length}종목
                      </p>
                      <small>완료 기록 없이 계획만 복사해요.</small>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label="복사한 루틴 비우기"
                      onClick={() => setClipboard(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="aside-tip">
                  <span>꾸준함을 위한 작은 도구</span>
                  <h3>
                    기록은 가볍게,
                    <br />
                    변화는 차곡차곡.
                  </h3>
                  <p>
                    지난 운동의 무게와 횟수도
                    <br />
                    세트 옆에서 확인할 수 있어요.
                  </p>
                  <Dumbbell size={52} strokeWidth={1} />
                </div>
              </aside>
              <section className="journal">
                <div className="journal-heading">
                  <div>
                    <span className="eyebrow">DAILY WORKOUT</span>
                    <h2>
                      {shortDate(selected)}
                      <span
                        className={`session-badge ${locked ? "finished" : ""}`}
                      >
                        {locked
                          ? "운동 완료"
                          : current.startedAt
                            ? "운동 중"
                            : "운동 계획"}
                      </span>
                    </h2>
                  </div>
                  <div className="journal-tools">
                    <button
                      className="icon-btn"
                      aria-label="하루 루틴 복사"
                      title="하루 루틴 복사"
                      onClick={() => copyDay()}
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="텍스트 내보내기"
                      title="텍스트 내보내기"
                      onClick={() => setDialog("export")}
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="하루 기록 삭제"
                      title="하루 기록 삭제"
                      onClick={() => {
                        if (!current.exercises.length && !current.note) return;
                        if (
                          confirm(
                            "이 날짜의 운동·시간·메모를 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.",
                          )
                        ) {
                          commit((next) => {
                            delete next.days[selected];
                            if (next.rest?.date === selected) next.rest = null;
                          });
                          stopSound();
                          notify("하루 기록을 삭제했어요.");
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="day-actions">
                  <button
                    className="button outline"
                    onClick={() => setDialog("load")}
                  >
                    <Bookmark size={15} />
                    루틴 불러오기
                  </button>
                  <button
                    className="button outline"
                    disabled={!current.exercises.length}
                    onClick={() => {
                      if (store.templates.length >= 10) {
                        notify(
                          "저장 루틴 10개가 가득 찼어요. 내 루틴에서 하나를 삭제해 주세요.",
                        );
                        return;
                      }
                      setTemplateName("");
                      setDialog("save");
                    }}
                  >
                    <Plus size={15} />
                    루틴 저장
                  </button>
                  {clipboard && (
                    <button
                      className="button outline"
                      onClick={() => applyRoutine(clipboard)}
                    >
                      <Clipboard size={15} />
                      붙여넣기
                    </button>
                  )}
                </div>
                <div className="session-controls">
                  {!current.startedAt ? (
                    <button
                      className="button primary"
                      disabled={!current.exercises.length}
                      onClick={startSession}
                    >
                      <Activity size={17} />
                      전체 운동 시작
                    </button>
                  ) : !locked ? (
                    <>
                      <span>
                        <span className="status-dot" />
                        전체 운동 진행 중
                      </span>
                      <button
                        className="button primary"
                        onClick={finishSession}
                      >
                        <CheckCheck size={17} />
                        전체 운동 종료
                      </button>
                    </>
                  ) : (
                    <span>
                      <CheckCheck size={17} />
                      종료한 운동 기록
                    </span>
                  )}
                  {current.startedAt &&
                    !locked &&
                    t.count > 0 &&
                    t.done === t.count && (
                      <small>
                        모든 세트를 마쳤어요. 전체 운동 종료를 눌러 주세요.
                      </small>
                    )}
                </div>
                <div className="session-overview">
                  <div>
                    <Timer size={17} />
                    <span>전체 운동시간</span>
                    <strong data-testid="session-time">
                      {clock(elapsed(current, now))}
                    </strong>
                  </div>
                  <div>
                    <span>완료 세트</span>
                    <strong>
                      {t.done}
                      <small> / {t.count}</small>
                    </strong>
                  </div>
                  <div>
                    <span>운동 볼륨</span>
                    <strong>
                      {t.volume.toLocaleString()}
                      <small> kg</small>
                    </strong>
                  </div>
                </div>
                <div
                  className="day-progress"
                  role="progressbar"
                  aria-label="완료한 세트"
                  aria-valuenow={t.done}
                  aria-valuemin={0}
                  aria-valuemax={t.count || 1}
                >
                  <span
                    style={{
                      width: `${t.count ? (t.done / t.count) * 100 : 0}%`,
                    }}
                  />
                </div>
                {!current.exercises.length ? (
                  <div className="empty-day">
                    <span className="empty-icon">
                      <Dumbbell size={33} strokeWidth={1.4} />
                    </span>
                    <h3>오늘은 어떤 운동을 할까요?</h3>
                    <p>
                      운동을 하나씩 추가하거나,
                      <br />
                      저장한 루틴으로 가볍게 시작해 보세요.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => setDialog("picker")}
                    >
                      <Plus size={17} />첫 운동 추가하기
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDialog("load")}
                    >
                      예시 루틴 둘러보기 <ChevronRight size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="workout-list">
                    {current.exercises.map((e, ei) => (
                      <WorkoutCard
                        key={e.id}
                        exercise={e}
                        index={ei}
                        day={current}
                        store={store}
                        date={selected}
                        onChange={updateDay}
                        onPair={(exercise) => {
                          setPairSource(exercise);
                          setDialog("superset");
                        }}
                        onRecord={completeSet}
                        onUndo={undoSet}
                      />
                    ))}
                  </div>
                )}
                {!!current.exercises.length && !locked && (
                  <button
                    className="add-exercise-button"
                    onClick={() => setDialog("picker")}
                  >
                    <Plus size={18} />
                    운동 추가하기
                  </button>
                )}
                {locked && (
                  <div className="finished-banner">
                    <CheckCheck size={23} />
                    <div>
                      <strong>오늘의 운동을 마쳤어요. 수고했어요!</strong>
                      <span>
                        전체 운동 종료를 누른 시각으로 운동시간을 저장했어요.
                      </span>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label="완료 기록 내보내기"
                      onClick={() => setDialog("export")}
                    >
                      <Download size={18} />
                    </button>
                  </div>
                )}
                <div className="day-note">
                  <label htmlFor="day-note">
                    <FileText size={16} />
                    오늘의 메모
                  </label>
                  <textarea
                    id="day-note"
                    maxLength={2000}
                    value={current.note}
                    onChange={(e) =>
                      updateDay((d) => {
                        d.note = e.target.value;
                      })
                    }
                    placeholder="오늘의 컨디션, 다음 운동에 기억하고 싶은 것…"
                    rows={2}
                  />
                </div>
                <div className="journal-footer">
                  <span>전체 운동 시작부터 전체 운동 종료까지 · 휴식 포함</span>
                  {current.startedAt && (
                    <button onClick={resetDay}>
                      <RotateCcw size={13} />
                      진행 기록 초기화
                    </button>
                  )}
                </div>
                <p className="measurement-note">
                  무게 방식에서 맨몸을 선택할 수 있어요. 덤벨은 한 손 무게를
                  권장해요. 좌우 운동은 한쪽 횟수를 기록하세요.
                  <br />
                  세트를 마치면 ‘휴식’을 누르세요. 슈퍼세트는 두 종목을 마친 뒤
                  휴식해요. 입력 시간은 목표이며, 별도 세트 카운트다운은 없어요.
                </p>
              </section>
            </div>
          </>
        ) : tab === "library" ? (
          <section className="full-panel">
            <div className="panel-page-heading">
              <h2>
                <Library size={21} />
                운동 도서관
              </h2>
              <span>{shortDate(selected)}에 추가</span>
            </div>
            <ExerciseLibrary
              custom={store.customExercises}
              onCustom={addCustom}
              onDelete={deleteCustom}
              onAdd={addExercise}
            />
          </section>
        ) : (
          <section className="full-panel">
            <div className="panel-page-heading">
              <h2>
                <Bookmark size={21} />내 루틴
              </h2>
              <span>불러올 날짜: {shortDate(selected)}</span>
            </div>
            {templatesContent}
          </section>
        )}
        <footer className="app-footer">
          <span>
            <Activity size={15} />
            오운 · 오늘의 움직임
          </span>
          <span>
            기록은 이 브라우저에 보관돼요. 설정에서 정기적으로 백업해 주세요.
          </span>
        </footer>
      </main>
      {(store.rest || timerNotice) && (
        <div
          className={`rest-timer ${timerNotice ? "rest-ended" : ""}`}
          role="status"
          aria-live="off"
        >
          <span className="timer-icon">
            <Bell size={23} />
          </span>
          <div className="rest-copy">
            <span>
              {timerNotice
                ? "휴식 끝! 다음 세트를 시작해요."
                : `세트 간 휴식 · ${store.rest ? shortDate(store.rest.date) : ""}`}
            </span>
            <strong>
              {timerNotice ? "다시 움직일 시간" : clock(remaining)}
            </strong>
          </div>
          {store.rest && (
            <>
              <button
                className="timer-adjust"
                onClick={() =>
                  commit((next) => {
                    if (next.rest) next.rest.endAt += 15000;
                  })
                }
              >
                +15초
              </button>
              <button className="timer-skip" onClick={cancelRest}>
                휴식 종료
              </button>
            </>
          )}
          <button
            className="icon-btn"
            aria-label="휴식 알림 닫기"
            onClick={cancelRest}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {dialog === "superset" && pairSource && (
        <Modal title="슈퍼세트 지정" onClose={() => setDialog(null)}>
          <p className="modal-intro">
            <strong>{pairSource.name}</strong>와 번갈아 할 운동을 선택해 주세요.
            두 종목은 같은 라운드로 진행하고, 둘 다 마친 뒤 휴식해요. 세트 수는
            더 많은 쪽에 맞추고 휴식은 첫 운동의 설정을 공유해요.
          </p>
          <div className="pair-options">
            {current.exercises
              .filter((e) => e.id !== pairSource.id && !e.supersetId)
              .map((e) => (
                <button
                  className="button outline"
                  key={e.id}
                  onClick={() => {
                    try {
                      updateDay((d) => pairExercises(d, pairSource.id, e.id));
                      setDialog(null);
                      notify("두 운동을 슈퍼세트로 연결했어요.");
                    } catch (error) {
                      notify(
                        error instanceof Error
                          ? error.message
                          : "슈퍼세트를 만들지 못했어요.",
                      );
                    }
                  }}
                >
                  <Dumbbell size={18} />
                  <span>
                    {e.name}
                    <small>
                      {e.sets.length}세트 · {e.category}
                    </small>
                  </span>
                  <Plus size={16} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {dialog === "picker" && (
        <Modal title="운동 추가하기" wide onClose={() => setDialog(null)}>
          <p className="modal-intro">
            {shortDate(selected)} · 여러 종목을 추가한 뒤 닫아 주세요.
          </p>
          <ExerciseLibrary
            custom={store.customExercises}
            onCustom={addCustom}
            onDelete={deleteCustom}
            onAdd={addExercise}
          />
          <div className="modal-bottom">
            <span>{current.exercises.length}종목 선택됨</span>
            <button className="button primary" onClick={() => setDialog(null)}>
              추가 완료 <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "load" && (
        <Modal title="하루 루틴 불러오기" wide onClose={() => setDialog(null)}>
          <p className="modal-intro">
            {shortDate(selected)}의 운동 계획으로 불러와요.
          </p>
          {templatesContent}
        </Modal>
      )}
      {dialog === "save" && (
        <Modal title="내 루틴에 저장" onClose={() => setDialog(null)}>
          <form onSubmit={saveTemplate} className="save-form">
            <p>
              {current.exercises.length}종목 · {t.count}세트의 운동 계획을
              저장해요.
              <br />
              완료 표시와 메모, 실제 운동시간은 포함하지 않아요.
            </p>
            <label>
              루틴 이름
              <input
                autoFocus
                maxLength={60}
                required
                placeholder="예: 월요일 덤벨 상체"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </label>
            <span className="help-text">
              저장 가능: {10 - store.templates.length}개 / 최대 10개
            </span>
            <button
              className="button primary full"
              disabled={!templateName.trim()}
              type="submit"
            >
              <Bookmark size={16} />
              루틴 저장
            </button>
          </form>
        </Modal>
      )}
      {dialog === "export" && (
        <Modal title="하루 운동 기록 내보내기" onClose={() => setDialog(null)}>
          <p className="modal-intro">
            완료·미완료 세트, 운동시간, 메모를 함께 내보내요.
          </p>
          <textarea
            className="export-text"
            aria-label="내보낼 운동 기록"
            readOnly
            value={sessionText(selected, current, now)}
            rows={15}
          />
          <div className="export-actions">
            <button
              className="button outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    sessionText(selected, current, Date.now()),
                  );
                  notify("운동 기록을 텍스트로 복사했어요.");
                } catch {
                  notify(
                    "자동 복사가 제한돼 있어요. 텍스트 상자에서 직접 선택해 복사하거나 파일로 내려받아 주세요.",
                  );
                }
              }}
            >
              <Copy size={16} />
              텍스트 복사
            </button>
            <button
              className="button primary"
              onClick={() =>
                download(
                  `오운-${selected}.txt`,
                  sessionText(selected, current, Date.now()),
                )
              }
            >
              <ArrowDownToLine size={16} />
              TXT 내려받기
            </button>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="설정과 데이터 관리" onClose={() => setDialog(null)}>
          <section className="settings-section">
            <h3>
              <Timer size={18} />
              휴식과 알림
            </h3>
            <label className="setting-row">
              <span>
                기본 휴식시간
                <small>새로 추가하는 운동에 적용 · 0초는 휴식 없음</small>
              </span>
              <span>
                <NumberInput
                  aria-label="기본 휴식시간 초"
                  min="0"
                  max="3600"
                  value={store.settings.restSeconds}
                  onChange={(e) =>
                    commit((next) => {
                      next.settings.restSeconds = Math.min(
                        3600,
                        Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      );
                    })
                  }
                />{" "}
                초
              </span>
            </label>
            <label className="setting-row">
              <span>
                휴식 종료 종소리
                <small>휴식이 끝나면 종소리 3번 + 화면 알림</small>
              </span>
              <input
                type="checkbox"
                checked={store.settings.sound}
                onChange={(e) => {
                  const sound = e.target.checked;
                  commit((next) => {
                    next.settings.sound = sound;
                  });
                  if (sound) void unlockSound();
                  else stopSound();
                }}
              />
            </label>
            <button
              className="button outline"
              onClick={async () => {
                if (await unlockSound()) ring();
              }}
            >
              <Bell size={16} />
              종소리 3번 테스트
            </button>
            <p className="help-text">
              소리는 기기 볼륨과 브라우저 정책을 따라요. 처음에는 소리 테스트를
              눌러 확인해 주세요. 화면 잠금·앱 종료·백그라운드에서는 알림이
              늦거나 소리가 나지 않을 수 있어요. 돌아오면 실제 종료 시각으로
              휴식 상태를 갱신해요.
            </p>
          </section>
          <section className="settings-section">
            <h3>
              <Download size={18} />
              기록 백업과 복원
            </h3>
            <p>
              운동 기록은 이 기기의 이 브라우저에만 저장돼요. 브라우저 데이터를
              삭제하면 사라질 수 있으니 정기적으로 백업해 주세요.
            </p>
            <div className="export-actions">
              <button
                className="button primary"
                onClick={() =>
                  download(
                    `오운-백업-${dateKey()}.json`,
                    JSON.stringify(store, null, 2),
                    "application/json",
                  )
                }
              >
                <Download size={16} />
                JSON 백업
              </button>
              <button
                className="button outline"
                onClick={() => importRef.current?.click()}
              >
                <Upload size={16} />
                백업 복원
              </button>
            </div>
            <input
              className="sr-only"
              ref={importRef}
              type="file"
              accept=".json,application/json"
              aria-label="JSON 백업 파일"
              onChange={(e) => {
                void restore(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="help-text">
              백업에는 날짜별 기록, 커스텀 운동, 저장 루틴과 설정이 포함돼요.
              복원은 현재 데이터를 교체해요. 클라우드 동기화 기능은 없어요.
            </p>
          </section>
        </Modal>
      )}
    </div>
  );
}
