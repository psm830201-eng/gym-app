import {
  ArrowDown,
  ArrowUp,
  Check,
  Link2,
  Plus,
  Timer,
  Unlink,
  X,
} from "lucide-react";
import type { Day, Store, WorkoutExercise } from "../types/workout";
import { moveExercise, newSet, partnerOf, previousSet } from "../lib/workout";
import { NumberInput } from "./NumberInput";
interface Props {
  exercise: WorkoutExercise;
  day: Day;
  store: Store;
  date: string;
  index: number;
  onChange: (change: (day: Day) => void) => void;
  onPair: (exercise: WorkoutExercise) => void;
  onRecord: (exercise: WorkoutExercise, index: number) => void;
  onUndo: (exercise: WorkoutExercise, index: number) => void;
}
export function WorkoutCard({
  exercise: e,
  day,
  store,
  date,
  index,
  onChange,
  onPair,
  onRecord,
  onUndo,
}: Props) {
  const locked = !!day.endedAt,
    partner = partnerOf(day, e),
    group = partner ? [e, partner] : [e];
  const edit = (change: (exercise: WorkoutExercise) => void) =>
    onChange((d) => {
      const item = d.exercises.find((x) => x.id === e.id);
      if (item) change(item);
    });
  const groupIds = Array.from(
    new Set(day.exercises.filter((x) => x.supersetId).map((x) => x.supersetId)),
  );
  const groupName = e.supersetId
    ? String.fromCharCode(65 + groupIds.indexOf(e.supersetId))
    : "";
  const firstInGroup = partner
    ? day.exercises.findIndex((x) => x.supersetId === e.supersetId)
    : index;
  const lastInGroup = partner
    ? Math.max(
        ...day.exercises.flatMap((x, i) =>
          x.supersetId === e.supersetId ? [i] : [],
        ),
      )
    : index;
  return (
    <article className={`workout-card ${partner ? "superset-card" : ""}`}>
      {partner && (
        <div className="superset-banner">
          <Link2 size={14} />
          <strong>슈퍼세트 {groupName}</strong>
          <span>{partner.name}와 번갈아 운동</span>
          <button
            aria-label={`${e.name} 슈퍼세트 해제`}
            disabled={!!day.startedAt}
            onClick={() =>
              onChange((d) => {
                d.exercises
                  .filter((x) => x.supersetId === e.supersetId)
                  .forEach((x) => delete x.supersetId);
              })
            }
          >
            <Unlink size={13} />
            해제
          </button>
        </div>
      )}
      <div className="workout-title">
        <span className="workout-order">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h3>{e.name}</h3>
          <span>
            {e.category} · {e.mode === "time" ? "시간 기록" : "무게 × 횟수"}
          </span>
        </div>
        <div className="exercise-controls">
          {!partner && (
            <button
              className="icon-btn"
              aria-label={`${e.name} 슈퍼세트 지정`}
              title="두 운동을 슈퍼세트로 묶기"
              disabled={
                !!day.startedAt ||
                day.exercises.filter((x) => !x.supersetId).length < 2
              }
              onClick={() => onPair(e)}
            >
              <Link2 size={16} />
            </button>
          )}
          <button
            className="icon-btn"
            disabled={firstInGroup === 0 || locked}
            aria-label={`${e.name} 위로 이동`}
            onClick={() => onChange((d) => moveExercise(d, e.id, -1))}
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="icon-btn"
            disabled={lastInGroup === day.exercises.length - 1 || locked}
            aria-label={`${e.name} 아래로 이동`}
            onClick={() => onChange((d) => moveExercise(d, e.id, 1))}
          >
            <ArrowDown size={15} />
          </button>
          <button
            className="icon-btn danger"
            disabled={!!day.startedAt}
            aria-label={`${e.name} 운동 삭제`}
            onClick={() => {
              if (confirm(`${e.name} 운동을 이 날짜에서 삭제할까요?`))
                onChange((d) => {
                  if (e.supersetId)
                    d.exercises
                      .filter((x) => x.supersetId === e.supersetId)
                      .forEach((x) => delete x.supersetId);
                  d.exercises = d.exercises.filter((x) => x.id !== e.id);
                });
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="set-table">
        <div className={`set-header ${e.mode === "time" ? "time-mode" : ""}`}>
          <span>세트</span>
          <span>지난 기록</span>
          {e.mode === "reps" ? (
            <>
              <span>무게</span>
              <span>횟수</span>
            </>
          ) : (
            <span>시간 (초)</span>
          )}
          <span>진행</span>
          <span />
        </div>
        {e.sets.map((s, si) => {
          const prev = previousSet(store, date, e.exerciseId, si),
            done = s.doneAt !== null,
            partnerDone = !!partner && partner.sets[si]?.doneAt != null;
          const earlierReady =
            !partner ||
            e.sets
              .slice(0, si)
              .every(
                (v, i) => v.doneAt !== null && partner.sets[i]?.doneAt != null,
              );
          const laterDone =
            !!partner &&
            group.some((x) =>
              x.sets.slice(si + 1).some((v) => v.doneAt !== null),
            );
          const action = done
            ? "완료 취소"
            : partner && !partnerDone
              ? "완료"
              : "휴식";
          return (
            <div
              className={`set-row ${e.mode === "time" ? "time-mode" : ""} ${done ? "set-done" : ""}`}
              key={s.id}
            >
              <span className="set-index">{si + 1}</span>
              <span
                className="previous-set"
                title={prev ? `${prev.date} 기록` : "이전 완료 기록 없음"}
              >
                {prev
                  ? e.mode === "time"
                    ? `${prev.set.seconds}초`
                    : `${prev.set.bodyweight ? "맨몸" : prev.set.weight} × ${prev.set.reps}`
                  : "—"}
              </span>
              {e.mode === "reps" ? (
                <>
                  <div className="weight-editor">
                    <select
                      aria-label={`${e.name} ${si + 1}세트 맨몸 또는 중량`}
                      disabled={done || locked}
                      value={s.bodyweight ? "bodyweight" : "weight"}
                      onChange={(ev) =>
                        edit((x) => {
                          x.sets[si].bodyweight =
                            ev.target.value === "bodyweight";
                        })
                      }
                    >
                      <option value="weight">중량 kg</option>
                      <option value="bodyweight">맨몸</option>
                    </select>
                    {!s.bodyweight && (
                      <NumberInput
                        aria-label={`${e.name} ${si + 1}세트 무게`}
                        min="0"
                        max="2000"
                        step="0.5"
                        value={s.weight}
                        disabled={done || locked}
                        onChange={(ev) =>
                          edit((x) => {
                            x.sets[si].weight = Math.min(
                              2000,
                              Math.max(0, Number(ev.target.value) || 0),
                            );
                          })
                        }
                      />
                    )}
                  </div>
                  <NumberInput
                    aria-label={`${e.name} ${si + 1}세트 횟수`}
                    min="1"
                    max="10000"
                    step="1"
                    value={s.reps}
                    disabled={done || locked}
                    onChange={(ev) =>
                      edit((x) => {
                        x.sets[si].reps = Math.min(
                          10000,
                          Math.max(0, Math.floor(Number(ev.target.value) || 0)),
                        );
                      })
                    }
                  />
                </>
              ) : (
                <NumberInput
                  aria-label={`${e.name} ${si + 1}세트 시간 초`}
                  min="1"
                  max="86400"
                  step="1"
                  value={s.seconds}
                  disabled={done || locked}
                  onChange={(ev) =>
                    edit((x) => {
                      x.sets[si].seconds = Math.min(
                        86400,
                        Math.max(0, Math.floor(Number(ev.target.value) || 0)),
                      );
                    })
                  }
                />
              )}
              <button
                className={`set-status ${done ? "done" : partner && !partnerDone ? "pair-complete" : "rest-button"}`}
                disabled={
                  locked ||
                  !day.startedAt ||
                  (!done &&
                    (!earlierReady ||
                      (e.mode === "reps" ? s.reps < 1 : s.seconds < 1))) ||
                  (done && laterDone)
                }
                aria-label={`${e.name} ${si + 1}세트 ${action}`}
                title={
                  !day.startedAt
                    ? "전체 운동 시작을 먼저 눌러 주세요."
                    : laterDone
                      ? "이후 슈퍼세트 라운드를 먼저 취소해 주세요."
                      : undefined
                }
                onClick={() => (done ? onUndo(e, si) : onRecord(e, si))}
              >
                {done ? (
                  <Check size={16} />
                ) : (
                  <>
                    {action === "휴식" ? (
                      <Timer size={12} />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>{action}</span>
                  </>
                )}
              </button>
              <button
                className="remove-set"
                disabled={
                  locked ||
                  e.sets.length <= 1 ||
                  group.some((x) => x.sets[si]?.doneAt !== null)
                }
                aria-label={`${e.name} ${si + 1}세트 삭제`}
                onClick={() =>
                  onChange((d) => {
                    for (const x of d.exercises.filter(
                      (x) =>
                        x.id === e.id ||
                        (e.supersetId && x.supersetId === e.supersetId),
                    ))
                      x.sets.splice(si, 1);
                  })
                }
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="workout-bottom">
        <button
          className="add-set"
          disabled={locked || e.sets.length >= 50}
          onClick={() =>
            onChange((d) => {
              for (const x of d.exercises.filter(
                (x) =>
                  x.id === e.id ||
                  (e.supersetId && x.supersetId === e.supersetId),
              ))
                x.sets.push(newSet(x.sets.at(-1)));
            })
          }
        >
          <Plus size={14} />
          세트 추가{partner ? " (두 종목)" : ""}
        </button>
        <label>
          <Timer size={13} />
          {partner ? "공유 휴식" : "휴식"}{" "}
          <NumberInput
            aria-label={`${e.name} 휴식 초`}
            min="0"
            max="3600"
            step="5"
            value={e.restSeconds}
            disabled={locked}
            onChange={(ev) =>
              onChange((d) => {
                for (const x of d.exercises.filter(
                  (x) =>
                    x.id === e.id ||
                    (e.supersetId && x.supersetId === e.supersetId),
                ))
                  x.restSeconds = Math.min(
                    3600,
                    Math.max(0, Math.floor(Number(ev.target.value) || 0)),
                  );
              })
            }
          />
          초
        </label>
      </div>
      {partner && (
        <p className="superset-help">
          같은 라운드의 첫 종목은 ‘완료’, 두 번째 종목은 ‘휴식’을 눌러요.
        </p>
      )}
    </article>
  );
}
