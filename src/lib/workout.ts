import { catalog } from "./catalog";
import { categories } from "../types/workout";
import type {
  Day,
  Exercise,
  Store,
  Template,
  WorkoutExercise,
  WorkoutSet,
} from "../types/workout";
export const STORAGE_KEY = "oun-workout-v1";
export const uid = () => crypto.randomUUID();
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const emptyDay = (): Day => ({
  exercises: [],
  note: "",
  startedAt: null,
  endedAt: null,
  activeSetId: null,
});
export const newSet = (previous?: WorkoutSet): WorkoutSet => ({
  id: uid(),
  weight: previous?.weight ?? 0,
  reps: previous?.reps ?? 10,
  seconds: previous?.seconds ?? 60,
  doneAt: null,
});
export const makeExercise = (
  exercise: Exercise,
  rest: number,
): WorkoutExercise => ({
  id: uid(),
  exerciseId: exercise.id,
  name: exercise.name,
  category: exercise.category,
  mode: exercise.mode,
  restSeconds: rest,
  sets: Array.from({ length: exercise.mode === "time" ? 1 : 3 }, () =>
    newSet(),
  ),
});
export const cloneRoutine = (exercises: WorkoutExercise[]): WorkoutExercise[] =>
  exercises.map((e) => ({
    ...e,
    id: uid(),
    sets: e.sets.map((s) => ({ ...s, id: uid(), doneAt: null })),
  }));
export const totals = (day: Day) => {
  const sets = day.exercises.flatMap((e) => e.sets);
  return {
    count: sets.length,
    done: sets.filter((s) => s.doneAt !== null).length,
    volume: day.exercises
      .filter((e) => e.mode === "reps")
      .reduce(
        (v, e) =>
          v +
          e.sets
            .filter((s) => s.doneAt !== null)
            .reduce((n, s) => n + s.weight * s.reps, 0),
        0,
      ),
  };
};
export const clock = (seconds: number) => {
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 3600) > 0 ? `${Math.floor(n / 3600)}:` : ""}${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
export const elapsed = (day: Day, now: number) =>
  day.startedAt
    ? Math.max(0, Math.floor(((day.endedAt ?? now) - day.startedAt) / 1000))
    : 0;
export const shortDate = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
export function initialStore(): Store {
  return {
    version: 1,
    days: {},
    customExercises: [],
    templates: [],
    settings: { restSeconds: 60, sound: true },
    rest: null,
  };
}
export function sessionText(key: string, day: Day, now: number): string {
  const t = totals(day);
  return [
    `오운 · ${shortDate(key)} (${key})`,
    `상태: ${day.endedAt ? "완료" : day.startedAt ? "운동 중" : "계획"}`,
    `전체 운동시간: ${clock(elapsed(day, now))}`,
    `세트: ${t.done}/${t.count} · 완료 볼륨: ${t.volume.toLocaleString()}kg`,
    ...(day.startedAt
      ? [`시작: ${new Date(day.startedAt).toLocaleString("ko-KR")}`]
      : []),
    ...(day.endedAt
      ? [`종료: ${new Date(day.endedAt).toLocaleString("ko-KR")}`]
      : []),
    "",
    ...day.exercises.flatMap((e, i) => [
      `${i + 1}. ${e.name} · ${e.category} · 휴식 ${e.restSeconds}초`,
      ...e.sets.map(
        (s, j) =>
          `  ${j + 1}세트: ${e.mode === "time" ? `${s.seconds}초` : `${s.weight}kg × ${s.reps}회`} ${s.doneAt !== null ? "[완료]" : "[미완료]"}`,
      ),
      "",
    ]),
    `메모: ${day.note || "없음"}`,
    "",
    "※ 운동시간은 첫 세트 시작부터 마지막 세트 완료까지, 휴식을 포함합니다. 덤벨 볼륨은 입력한 무게 기준입니다.",
  ].join("\n");
}
export const previousSet = (
  store: Store,
  key: string,
  exerciseId: string,
  index: number,
) =>
  Object.keys(store.days)
    .filter((d) => d < key)
    .sort()
    .reverse()
    .flatMap((d) =>
      store.days[d].exercises
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => ({ date: d, set: e.sets[index] })),
    )
    .find((p) => p.set?.doneAt !== null && p.set !== undefined);
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && dateKey(d) === value;
}
export function parseStore(raw: string): Store {
  if (raw.length > 5_000_000) throw Error("백업 파일은 5MB 이하만 지원해요.");
  const value: unknown = JSON.parse(raw);
  const obj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const str = (v: unknown, max = 200): v is string =>
    typeof v === "string" && v.length > 0 && v.length <= max;
  const num = (v: unknown, max = 100000): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
  const stamp = (v: unknown) =>
    v === null || (num(v, 8640000000000000) && v > 0);
  const exs = (v: unknown): boolean =>
    Array.isArray(v) &&
    v.length <= 100 &&
    v.every(
      (e) =>
        obj(e) &&
        str(e.id) &&
        str(e.exerciseId) &&
        str(e.name, 80) &&
        categories.includes(e.category as never) &&
        ["reps", "time"].includes(String(e.mode)) &&
        num(e.restSeconds, 3600) &&
        Array.isArray(e.sets) &&
        e.sets.length > 0 &&
        e.sets.length <= 50 &&
        e.sets.every(
          (s) =>
            obj(s) &&
            str(s.id) &&
            num(s.weight, 2000) &&
            num(s.reps, 10000) &&
            num(s.seconds, 86400) &&
            stamp(s.doneAt),
        ) &&
        new Set(e.sets.map((s: WorkoutSet) => s.id)).size === e.sets.length,
    ) &&
    new Set(v.map((e) => e.id)).size === v.length;
  if (
    !obj(value) ||
    value.version !== 1 ||
    !obj(value.days) ||
    Object.keys(value.days).length > 4000 ||
    !Array.isArray(value.templates) ||
    value.templates.length > 10 ||
    !Array.isArray(value.customExercises) ||
    value.customExercises.length > 500 ||
    !obj(value.settings) ||
    !num(value.settings.restSeconds, 3600) ||
    typeof value.settings.sound !== "boolean"
  )
    throw Error("올바른 오운 백업 파일이 아니에요.");
  for (const [key, d] of Object.entries(value.days)) {
    if (
      !validDate(key) ||
      !obj(d) ||
      !exs(d.exercises) ||
      typeof d.note !== "string" ||
      d.note.length > 2000 ||
      !stamp(d.startedAt) ||
      !stamp(d.endedAt) ||
      (d.endedAt !== null &&
        (d.startedAt === null || Number(d.endedAt) < Number(d.startedAt))) ||
      (d.activeSetId !== null && !str(d.activeSetId))
    )
      throw Error("날짜 또는 운동 기록 형식이 올바르지 않아요.");
    const day = d as unknown as Day;
    if (
      new Set(day.exercises.flatMap((e) => e.sets.map((s) => s.id))).size !==
      day.exercises.flatMap((e) => e.sets).length
    )
      throw Error("중복된 세트 ID가 있어요.");
    if (
      (day.activeSetId && (!day.startedAt || day.endedAt)) ||
      (!day.startedAt &&
        day.exercises.some((e) => e.sets.some((s) => s.doneAt !== null)))
    )
      throw Error("세션 시작 정보가 올바르지 않아요.");
    if (
      day.activeSetId &&
      !day.exercises.some((e) =>
        e.sets.some((s) => s.id === day.activeSetId && s.doneAt === null),
      )
    )
      throw Error("진행 중인 세트가 올바르지 않아요.");
  }
  for (const e of value.customExercises)
    if (
      !obj(e) ||
      !str(e.id) ||
      !str(e.name, 80) ||
      !categories.includes(e.category as never) ||
      !["맨몸", "덤벨", "바벨·머신", "유산소", "기타"].includes(
        String(e.equipment),
      ) ||
      !["reps", "time"].includes(String(e.mode)) ||
      typeof e.tip !== "string" ||
      e.tip.length > 1000
    )
      throw Error("사용자 운동 형식이 올바르지 않아요.");
  for (const t of value.templates)
    if (!obj(t) || !str(t.id) || !str(t.name, 60) || !exs(t.exercises))
      throw Error("저장 루틴 형식이 올바르지 않아요.");
  if (
    new Set(value.templates.map((t: Template) => t.id)).size !==
      value.templates.length ||
    new Set(value.customExercises.map((e: Exercise) => e.id)).size !==
      value.customExercises.length
  )
    throw Error("중복된 기록 ID가 있어요.");
  if (
    Object.values(value.days).filter((d) => {
      const day = d as Day;
      return day.startedAt && !day.endedAt;
    }).length > 1
  )
    throw Error("진행 중인 세션은 하나만 가능해요.");
  if (
    value.rest !== null &&
    (!obj(value.rest) ||
      !num(value.rest.endAt, 8640000000000000) ||
      !num(value.rest.duration, 3600) ||
      !str(value.rest.date) ||
      !validDate(value.rest.date))
  )
    throw Error("휴식 정보가 올바르지 않아요.");
  return value as unknown as Store;
}
export function loadStore(): { store: Store; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { store: raw ? parseStore(raw) : initialStore(), error: null };
  } catch {
    return {
      store: initialStore(),
      error:
        "기존 기록을 읽지 못했어요. 원본 저장 데이터는 보존했습니다. 백업을 복원하거나 저장을 다시 허용해 주세요.",
    };
  }
}
export function starterRoutine(
  type: "full" | "upper" | "cardio",
  rest: number,
): WorkoutExercise[] {
  const names =
    type === "full"
      ? ["스쿼트", "푸시업", "원암 덤벨 로우", "플랭크"]
      : type === "upper"
        ? ["덤벨 벤치프레스", "덤벨 숄더 프레스", "덤벨 컬"]
        : ["빠르게 걷기", "실내 자전거", "스트레칭"];
  return names.map((name) =>
    makeExercise(
      catalog.find((e) => e.name === name)!,
      rest,
    ),
  );
}
