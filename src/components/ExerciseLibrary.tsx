import { useState } from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { categories } from "../types/workout";
import type { Category, Equipment, Exercise, Mode } from "../types/workout";
import { catalog } from "../lib/catalog";
import { uid } from "../lib/workout";
interface Props {
  custom: Exercise[];
  onAdd?: (e: Exercise) => void;
  onCustom: (e: Exercise) => void;
  onDelete: (id: string) => void;
}
export function ExerciseLibrary({ custom, onAdd, onCustom, onDelete }: Props) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("전체"),
    [equipment, setEquipment] = useState("전체"),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [customCategory, setCustomCategory] = useState<Category>("가슴"),
    [mode, setMode] = useState<Mode>("reps"),
    [gear, setGear] = useState<Equipment>("맨몸"),
    [added, setAdded] = useState<Record<string, number>>({}),
    [error, setError] = useState("");
  const exercises = [...custom, ...catalog].filter(
    (e) =>
      (category === "전체" || e.category === category) &&
      (equipment === "전체" || e.equipment === equipment) &&
      e.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="운동 검색"
            placeholder="운동 이름으로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className="button outline"
          onClick={() => setCreating(!creating)}
        >
          <Plus size={17} />
          직접 추가
        </button>
      </div>
      {creating && (
        <form
          className="custom-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if ([...catalog, ...custom].some((x) => x.name === name.trim())) {
              setError("같은 이름의 운동이 이미 있어요.");
              return;
            }
            if (custom.length >= 500) {
              setError("커스텀 운동은 500개까지 저장할 수 있어요.");
              return;
            }
            onCustom({
              id: uid(),
              name: name.trim(),
              category: customCategory,
              equipment: gear,
              mode,
              tip:
                mode === "time"
                  ? "시간은 초 단위로 기록해요."
                  : "입력한 무게 기준으로 볼륨을 계산해요.",
            });
            setName("");
            setCreating(false);
            setError("");
            setQuery("");
            setCategory("전체");
            setEquipment("전체");
          }}
        >
          <h3>나만의 운동 만들기</h3>
          <label>
            운동 이름
            <input
              maxLength={80}
              required
              placeholder="예: 덤벨 리버스 플라이"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              분류
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as Category)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              도구
              <select
                value={gear}
                onChange={(e) => setGear(e.target.value as Equipment)}
              >
                {["맨몸", "덤벨", "바벨·머신", "유산소", "기타"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              기록 방식
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="reps">무게 × 횟수</option>
                <option value="time">시간 (초)</option>
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button className="button primary" type="submit">
            운동 저장
          </button>
        </form>
      )}
      <div className="category-tabs" aria-label="운동 분류">
        {["전체", ...categories].map((c) => (
          <button
            aria-pressed={category === c}
            className={category === c ? "active" : ""}
            onClick={() => setCategory(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="equipment-filter">
        <span>{exercises.length}개 운동</span>
        <label>
          도구{" "}
          <select
            aria-label="운동 도구 필터"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          >
            {["전체", "맨몸", "덤벨", "바벨·머신", "유산소", "기타"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
      </div>
      <div className="exercise-results">
        {exercises.map((e) => (
          <article className="library-exercise" key={e.id}>
            <div className="exercise-monogram">{e.category.slice(0, 1)}</div>
            <div className="library-info">
              <h3>
                {e.name}
                {custom.some((c) => c.id === e.id) && (
                  <span className="custom-badge">MY</span>
                )}
              </h3>
              <p>
                {e.category} · {e.equipment} ·{" "}
                {e.mode === "time" ? "시간" : "무게 × 횟수"}
              </p>
              <small>{e.tip}</small>
            </div>
            <div className="library-actions">
              {onAdd && (
                <button
                  className="icon-btn add"
                  onClick={() => {
                    onAdd(e);
                    setAdded((v) => ({ ...v, [e.id]: (v[e.id] || 0) + 1 }));
                  }}
                  aria-label={`${e.name} 추가`}
                >
                  {added[e.id] ? <Check size={19} /> : <Plus size={19} />}
                  <span>{added[e.id] || ""}</span>
                </button>
              )}
              {custom.some((c) => c.id === e.id) && (
                <button
                  className="icon-btn danger"
                  aria-label={`${e.name} 삭제`}
                  onClick={() => onDelete(e.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
        ))}
        {!exercises.length && (
          <div className="empty-small">
            찾는 운동이 없나요? ‘직접 추가’로 만들어 보세요.
          </div>
        )}
      </div>
    </>
  );
}
