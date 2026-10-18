export const categories = [
  "가슴",
  "등",
  "어깨",
  "하체",
  "팔",
  "코어",
  "유산소",
  "전신",
] as const;
export type Category = (typeof categories)[number];
export type Mode = "reps" | "time";
export type Equipment = "맨몸" | "덤벨" | "바벨·머신" | "유산소" | "기타";
export interface Exercise {
  id: string;
  name: string;
  category: Category;
  equipment: Equipment;
  mode: Mode;
  tip: string;
}
export interface WorkoutSet {
  id: string;
  weight: number;
  bodyweight?: boolean;
  reps: number;
  seconds: number;
  doneAt: number | null;
}
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  name: string;
  category: Category;
  mode: Mode;
  restSeconds: number;
  equipment?: Equipment;
  supersetId?: string;
  sets: WorkoutSet[];
}
export interface Day {
  exercises: WorkoutExercise[];
  note: string;
  startedAt: number | null;
  endedAt: number | null;
  activeSetId: string | null;
}
export interface Template {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
}
export interface Rest {
  endAt: number;
  duration: number;
  date: string;
}
export interface Store {
  version: 1;
  days: Record<string, Day>;
  customExercises: Exercise[];
  templates: Template[];
  settings: { restSeconds: number; sound: boolean };
  rest: Rest | null;
}
