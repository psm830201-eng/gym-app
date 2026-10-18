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
  bodyweight: previous?.bodyweight ?? false,
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
  equipment: exercise.equipment,
  restSeconds: rest,
  sets: Array.from({ length: exercise.mode === "time" ? 1 : 3 }, () => ({
    ...newSet(),
    bodyweight: exercise.equipment === "맨몸" && exercise.mode === "reps",
  })),
});
export const cloneRoutine = (
  exercises: WorkoutExercise[],
): WorkoutExercise[] => {
  const groups = new Map<string, string>();
  return exercises.map((e) => {
    if (e.supersetId && !groups.has(e.supersetId))
      groups.set(e.supersetId, uid());
    return {
      ...e,
      id: uid(),
      ...(e.supersetId ? { supersetId: groups.get(e.supersetId) } : {}),
      sets: e.sets.map((s) => ({ ...s, id: uid(), doneAt: null })),
    };
  });
};
export const partnerOf = (day: Day, exercise: WorkoutExercise) =>
  exercise.supersetId
    ? day.exercises.find(
        (e) => e.id !== exercise.id && e.supersetId === exercise.supersetId,
      )
    : undefined;
export function pairExercises(day: Day, firstId: string, secondId: string) {
  const first = day.exercises.find((e) => e.id === firstId),
    second = day.exercises.find((e) => e.id === secondId);
  if (
    !first ||
    !second ||
    first === second ||
    first.supersetId ||
    second.supersetId ||
    day.startedAt
  )
    throw Error("시작 전의 서로 다른 두 운동을 선택해 주세요.");
  const count = Math.max(first.sets.length, second.sets.length),
    group = uid();
  for (const e of [first, second]) {
    e.supersetId = group;
    while (e.sets.length < count) e.sets.push(newSet(e.sets.at(-1)));
  }
  const rest = first.restSeconds;
  second.restSeconds = rest;
  const items = day.exercises.filter((e) => e.id !== second.id),
    index = items.findIndex((e) => e.id === first.id);
  items.splice(index + 1, 0, second);
  day.exercises = items;
}
export function moveExercise(day: Day, id: string, direction: -1 | 1) {
  const groups: WorkoutExercise[][] = [];
  for (const e of day.exercises) {
    const group = e.supersetId
      ? groups.find((g) => g[0].supersetId === e.supersetId)
      : undefined;
    if (group) group.push(e);
    else groups.push([e]);
  }
  const i = groups.findIndex((g) => g.some((e) => e.id === id)),
    j = i + direction;
  if (i < 0 || j < 0 || j >= groups.length) return;
  [groups[i], groups[j]] = [groups[j], groups[i]];
  day.exercises = groups.flat();
}
export function recordSet(
  day: Day,
  exerciseId: string,
  index: number,
  stamp: number,
): { rest: boolean; seconds: number } {
  if (!day.startedAt || day.endedAt)
    throw Error("전체 운동 시작을 먼저 눌러 주세요.");
  const exercise = day.exercises.find((e) => e.id === exerciseId),
    set = exercise?.sets[index];
  if (!exercise || !set || set.doneAt !== null)
    throw Error("이미 기록했거나 찾을 수 없는 세트예요.");
  if (
    (exercise.mode === "reps" && set.reps < 1) ||
    (exercise.mode === "time" && set.seconds < 1)
  )
    throw Error("횟수 또는 시간을 1 이상 입력해 주세요.");
  const partner = partnerOf(day, exercise);
  if (
    partner &&
    index > 0 &&
    !exercise.sets
      .slice(0, index)
      .every((s, i) => s.doneAt !== null && partner.sets[i]?.doneAt !== null)
  )
    throw Error("이전 슈퍼세트 라운드를 먼저 마쳐 주세요.");
  set.doneAt = stamp;
  day.activeSetId = null;
  return {
    rest: !partner || partner.sets[index]?.doneAt != null,
    seconds: exercise.restSeconds,
  };
}
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
            .reduce((n, s) => n + (s.bodyweight ? 0 : s.weight * s.reps), 0),
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
      `${i + 1}. ${e.name} · ${e.category} · 휴식 ${e.restSeconds}초${
        e.supersetId
          ? ` · 슈퍼세트 (${day.exercises
              .filter((x) => x.supersetId === e.supersetId)
              .map((x) => x.name)
              .join(" + ")})`
          : ""
      }`,
      ...e.sets.map(
        (s, j) =>
          `  ${j + 1}세트: ${e.mode === "time" ? `${s.seconds}초` : `${s.bodyweight ? "맨몸" : `${s.weight}kg`} × ${s.reps}회`} ${s.doneAt !== null ? "[완료]" : "[미완료]"}`,
      ),
      "",
    ]),
    `메모: ${day.note || "없음"}`,
    "",
    "※ 운동시간은 전체 운동 시작부터 전체 운동 종료까지, 휴식을 포함합니다. 덤벨 볼륨은 입력한 무게 기준입니다.",
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
        (e.equipment === undefined ||
          ["맨몸", "덤벨", "바벨·머신", "유산소", "기타"].includes(
            String(e.equipment),
          )) &&
        (e.supersetId === undefined || str(e.supersetId)) &&
        Array.isArray(e.sets) &&
        e.sets.length > 0 &&
        e.sets.length <= 50 &&
        e.sets.every(
          (s) =>
            obj(s) &&
            str(s.id) &&
            num(s.weight, 2000) &&
            (s.bodyweight === undefined || typeof s.bodyweight === "boolean") &&
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
  const result = value as unknown as Store;
  for (const exercises of [
    ...Object.values(result.days).map((d) => d.exercises),
    ...result.templates.map((t) => t.exercises),
  ]) {
    const groups = new Map<string, WorkoutExercise[]>();
    for (const e of exercises) {
      e.equipment ??=
        catalog.find((c) => c.id === e.exerciseId)?.equipment ??
        result.customExercises.find((c) => c.id === e.exerciseId)?.equipment ??
        "기타";
      for (const s of e.sets)
        s.bodyweight ??=
          e.equipment === "맨몸" && e.mode === "reps" && s.weight === 0;
      if (e.supersetId)
        groups.set(e.supersetId, [...(groups.get(e.supersetId) || []), e]);
    }
    for (const group of groups.values())
      if (
        group.length !== 2 ||
        group[0].sets.length !== group[1].sets.length ||
        group[0].restSeconds !== group[1].restSeconds
      )
        throw Error(
          "슈퍼세트는 같은 세트 수와 휴식시간을 가진 두 운동으로 구성해야 해요.",
        );
  }
  // Legacy per-set start flags no longer gate the explicit full-session controls.
  for (const day of Object.values(result.days)) day.activeSetId = null;
  return result;
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
