import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { catalog } from "../src/lib/catalog";
import {
  clock,
  elapsed,
  emptyDay,
  parseStore,
  initialStore,
  cloneRoutine,
  makeExercise,
  totals,
  sessionText,
  pairExercises,
  recordSet,
} from "../src/lib/workout";

async function add(page: Page, name: string) {
  await page
    .getByRole("button", { name: /첫 운동 추가하기|^운동 추가하기$/ })
    .click();
  await page.getByRole("dialog").getByLabel("운동 검색").fill(name);
  await page.getByRole("button", { name: `${name} 추가`, exact: true }).click();
  await page.getByRole("button", { name: "추가 완료", exact: true }).click();
}
async function seed(page: Page, data: unknown) {
  await page.goto("/");
  await page.evaluate(
    (v) => localStorage.setItem("oun-workout-v1", JSON.stringify(v)),
    data,
  );
  await page.reload();
}
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("Workout model: copy resets completion; time, volume, export and backup validation", () => {
  const exercise = makeExercise(
    catalog.find((e) => e.name === "푸시업")!,
    60,
  );
  exercise.sets[0].weight = 10;
  exercise.sets[0].bodyweight = false;
  exercise.sets[0].reps = 12;
  exercise.sets[0].doneAt = 2000;
  const day = {
    ...emptyDay(),
    exercises: [exercise],
    startedAt: 1000,
    endedAt: 61000,
  };
  expect(totals(day)).toEqual({ count: 3, done: 1, volume: 120 });
  expect(elapsed(day, 90000)).toBe(60);
  expect(clock(3661)).toBe("1:01:01");
  const copied = cloneRoutine(day.exercises);
  expect(copied[0].id).not.toBe(exercise.id);
  expect(copied[0].sets[0].doneAt).toBeNull();
  expect(copied[0].sets[0].weight).toBe(10);
  expect(sessionText("2026-10-18", day, 90000)).toContain("10kg × 12회 [완료]");
  const store = initialStore();
  store.days["2026-10-18"] = day;
  expect(parseStore(JSON.stringify(store))).toEqual(store);
  expect(() => parseStore(JSON.stringify({ ...store, version: 9 }))).toThrow();
  expect(() =>
    parseStore(JSON.stringify({ ...store, templates: Array(11).fill({}) })),
  ).toThrow();
  expect(() =>
    parseStore(JSON.stringify({ ...store, days: { "2026-02-30": day } })),
  ).toThrow();
  expect(() => parseStore("{broken")).toThrow();
});

test("add exercises, edit sets, copy by long press, paste and persist after refresh", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await add(page, "덤벨 벤치프레스");
  await page.getByLabel("덤벨 벤치프레스 1세트 무게").fill("12.5");
  await page.getByLabel("덤벨 벤치프레스 1세트 횟수").fill("12");
  await page.getByRole("button", { name: "세트 추가", exact: true }).click();
  await expect(page.getByLabel("덤벨 벤치프레스 4세트 무게")).toBeVisible();
  await page.getByLabel("덤벨 벤치프레스 4세트 삭제").click();
  await add(page, "플랭크");
  await page.getByLabel("플랭크 1세트 시간 초").fill("45");
  await page.getByLabel("플랭크 위로 이동").click();
  await expect(page.locator(".workout-card h3").first()).toHaveText("플랭크");
  await page.getByLabel("오늘의 메모").fill("어깨 무리하지 않기");
  const selected = page.locator(".calendar-day.selected");
  await selected.dispatchEvent("pointerdown", {
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  await page.waitForTimeout(720);
  await selected.dispatchEvent("pointerup");
  await expect(page.getByText("복사한 루틴", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await page.locator(".calendar-day").first().click();
  await page.getByRole("button", { name: "선택한 날짜에 붙여넣기" }).click();
  await expect(page.getByLabel("덤벨 벤치프레스 1세트 무게")).toHaveValue(
    "12.5",
  );
  await expect(page.getByLabel("플랭크 1세트 시간 초")).toHaveValue("45");
  await expect(page.getByLabel("오늘의 메모")).toHaveValue("");
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oun-workout-v1")!),
  );
  expect(Object.keys(record.days)).toHaveLength(2);
  await page.reload();
  await expect(page.getByLabel("오늘의 메모")).toHaveValue(
    "어깨 무리하지 않기",
  );
  expect(errors).toEqual([]);
});

test("custom exercises and templates: load, delete, and enforce maximum 10", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "운동 도서관" }).click();
  await page.getByRole("button", { name: "직접 추가" }).click();
  await page.getByLabel("운동 이름", { exact: true }).fill("내 버티기");
  await page
    .getByRole("combobox", { name: "기록 방식", exact: true })
    .selectOption("time");
  await page.getByRole("button", { name: "운동 저장", exact: true }).click();
  await page.getByLabel("운동 검색").fill("내 버티기");
  await page
    .getByRole("button", { name: "내 버티기 추가", exact: true })
    .click();
  await page.getByRole("button", { name: "운동 기록", exact: true }).click();
  await page.getByLabel("내 버티기 1세트 시간 초").fill("90");
  await page.getByRole("button", { name: "루틴 저장", exact: true }).click();
  await page.getByLabel("루틴 이름").fill("나의 코어");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "루틴 저장", exact: true })
    .click();
  await page.getByRole("button", { name: "내 루틴" }).click();
  await expect(page.getByRole("heading", { name: "나의 코어" })).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "불러오기", exact: true }).click();
  await expect(page.getByLabel("내 버티기 1세트 시간 초")).toHaveValue("90");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oun-workout-v1")!),
  );
  stored.templates = Array.from({ length: 10 }, (_, i) => ({
    ...stored.templates[0],
    id: `t-${i}`,
    name: `루틴 ${i + 1}`,
  }));
  await seed(page, stored);
  await page.getByRole("button", { name: "루틴 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("10개가 가득");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "내 루틴" }).click();
  await page.getByLabel("루틴 1 루틴 삭제", { exact: true }).click();
  await expect(page.locator(".template-item")).toHaveCount(9);
});

test("session timing, rest alarm creates exactly 3 bell tones, completion freezes time and export", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    Object.defineProperty(window, "bellCount", { value: 0, writable: true });
    AudioContext.prototype.createOscillator = function () {
      (window as unknown as { bellCount: number }).bellCount++;
      return original.call(this);
    };
  });
  await page.goto("/");
  await add(page, "고블릿 스쿼트");
  await page.getByLabel("고블릿 스쿼트 휴식 초").fill("1");
  await page.getByLabel("고블릿 스쿼트 1세트 무게").fill("10");
  await page.getByLabel("고블릿 스쿼트 1세트 횟수").fill("12");
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "전체 운동 시작", exact: true })
    .click();
  await expect(
    page.getByLabel("고블릿 스쿼트 1세트 휴식", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByLabel("고블릿 스쿼트 1세트 휴식", { exact: true }).click();
  await expect(page.locator(".rest-timer")).toBeVisible();
  await expect(page.locator(".rest-timer")).toContainText("다시 움직일 시간", {
    timeout: 5000,
  });
  expect(
    await page.evaluate(
      () => (window as unknown as { bellCount: number }).bellCount,
    ),
  ).toBe(3);
  await page.getByLabel("고블릿 스쿼트 2세트 휴식", { exact: true }).click();
  await expect(page.locator(".rest-timer")).toBeVisible();
  await page.getByRole("button", { name: "휴식 종료" }).click();
  await page.getByLabel("고블릿 스쿼트 3세트 휴식", { exact: true }).click();
  await expect(page.locator(".finished-banner")).toHaveCount(0);
  await page
    .getByRole("button", { name: "전체 운동 종료", exact: true })
    .click();
  await expect(page.locator(".finished-banner")).toBeVisible();
  await expect(page.locator(".rest-timer")).toHaveCount(0);
  const time = await page.getByTestId("session-time").textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("session-time")).toHaveText(time!);
  await page.getByLabel("텍스트 내보내기", { exact: true }).click();
  await expect(page.getByLabel("내보낼 운동 기록")).toContainText(
    "10kg × 12회 [완료]",
  );
  await expect(page.getByLabel("내보낼 운동 기록")).toContainText("상태: 완료");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "TXT 내려받기" }).click();
  expect((await dl).suggestedFilename()).toContain(".txt");
  await page.getByLabel("닫기", { exact: true }).click();
  await page.reload();
  await expect(page.locator(".finished-banner")).toBeVisible();
  await expect(page.getByTestId("session-time")).toHaveText(time!);
});

test("backup restore validates input, restores custom exercises and templates; corrupt storage is preserved", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByLabel("설정과 백업").click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업", exact: true }).click();
  expect((await dl).suggestedFilename()).toContain(".json");
  const s = initialStore();
  s.customExercises = [
    {
      id: "my",
      name: "복원 운동",
      category: "코어",
      equipment: "맨몸",
      mode: "time",
      tip: "",
    },
  ];
  s.templates = [
    {
      id: "saved",
      name: "복원 루틴",
      exercises: [makeExercise(s.customExercises[0], 10)],
    },
  ];
  await page.getByLabel("JSON 백업 파일").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "내 루틴" }).click();
  await expect(page.getByRole("heading", { name: "복원 루틴" })).toBeVisible();
  await page.getByLabel("설정과 백업").click();
  await page.getByLabel("JSON 백업 파일").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"bad":1}'),
  });
  await expect(page.locator(".toast")).toContainText("올바른 오운 백업");
  await page.getByLabel("닫기", { exact: true }).click();
  await page.evaluate(() => localStorage.setItem("oun-workout-v1", "{broken"));
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("oun-workout-v1")),
  ).toBe("{broken");
});

for (const width of [360, 390, 768, 1440])
  test(`responsive ${width}px: calendar, populated routine, library, dialogs without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const s = initialStore();
    s.days[today()] = {
      ...emptyDay(),
      exercises: [
        makeExercise(
          catalog.find((e) => e.name === "덤벨 트라이셉스 익스텐션")!,
          60,
        ),
        makeExercise(
          catalog.find((e) => e.name === "플랭크")!,
          60,
        ),
      ],
    };
    pairExercises(
      s.days[today()],
      s.days[today()].exercises[0].id,
      s.days[today()].exercises[1].id,
    );
    await seed(page, s);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/oun-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "운동 도서관" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("설정과 백업").click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(width);
  });

test("time-based session survives reload, prevents another active day, supports finishing with incomplete sets", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await add(page, "플랭크");
  await add(page, "걷기");
  await page.getByLabel("플랭크 1세트 시간 초").fill("45");
  await page
    .getByRole("button", { name: "전체 운동 시작", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByLabel("플랭크 1세트 휴식", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("플랭크 1세트 휴식", { exact: true }).click();
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oun-workout-v1")!),
  );
  const day = record.days[today()];
  expect(day.startedAt).toBeGreaterThan(0);
  expect(day.endedAt).toBeNull();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await page.locator(".calendar-day").first().click();
  await add(page, "푸시업");
  await page
    .getByRole("button", { name: "전체 운동 시작", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("다른 날짜의 운동을 먼저");
  await page.locator(".active-session-banner").click();
  await page
    .getByRole("button", { name: "전체 운동 종료", exact: true })
    .click();
  await expect(page.locator(".finished-banner")).toBeVisible();
  const finished = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oun-workout-v1")!),
  );
  expect(finished.days[today()].endedAt).toBeGreaterThanOrEqual(
    day.exercises[0].sets[0].doneAt,
  );
  await page.getByLabel("텍스트 내보내기", { exact: true }).click();
  await expect(page.getByLabel("내보낼 운동 기록")).toContainText(
    "45초 [완료]",
  );
  await expect(page.getByLabel("내보낼 운동 기록")).toContainText(
    "60초 [미완료]",
  );
});

test("silent rest can be extended, survives reload, and uses absolute deadline", async ({
  page,
}) => {
  const s = initialStore();
  s.settings.sound = false;
  s.rest = { duration: 60, endAt: Date.now() + 60000, date: today() };
  await seed(page, s);
  await expect(page.locator(".rest-timer")).toBeVisible();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("oun-workout-v1")!).rest.endAt,
  );
  await page.getByRole("button", { name: "+15초", exact: true }).click();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("oun-workout-v1")!).rest.endAt,
  );
  expect(after - before).toBe(15000);
  await page.reload();
  await expect(page.locator(".rest-timer")).toBeVisible();
  await page.getByRole("button", { name: "휴식 종료" }).click();
  await expect(page.locator(".rest-timer")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("oun-workout-v1")!).rest,
    ),
  ).toBeNull();
  const expired = { ...s, rest: { ...s.rest, endAt: Date.now() - 1000 } };
  await seed(page, expired);
  await expect(page.locator(".rest-timer")).toContainText("다시 움직일 시간");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("oun-workout-v1")!).rest,
    ),
  ).toBeNull();
});

test("numeric zero clears on focus and persists typed values; bodyweight is selectable per set", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "덤벨 벤치프레스");
  const weight = page.getByLabel("덤벨 벤치프레스 1세트 무게", { exact: true });
  await expect(weight).toHaveValue("0");
  await weight.focus();
  await expect(weight).toHaveValue("");
  await page.waitForTimeout(600);
  await expect(weight).toHaveValue("");
  await weight.fill("17.5");
  await page.getByLabel("오늘의 메모").click();
  await expect(weight).toHaveValue("17.5");
  const reps = page.getByLabel("덤벨 벤치프레스 1세트 횟수", { exact: true });
  await reps.fill("0");
  await reps.blur();
  await reps.focus();
  await expect(reps).toHaveValue("");
  await reps.fill("12");
  await page
    .getByRole("combobox", {
      name: "덤벨 벤치프레스 1세트 맨몸 또는 중량",
      exact: true,
    })
    .selectOption("bodyweight");
  await expect(weight).toHaveCount(0);
  await add(page, "플랭크");
  const duration = page.getByLabel("플랭크 1세트 시간 초", { exact: true });
  await duration.fill("0");
  await duration.blur();
  await duration.focus();
  await expect(duration).toHaveValue("");
  await duration.fill("45");
  await page
    .getByRole("button", { name: "전체 운동 시작", exact: true })
    .click();
  await page.getByLabel("덤벨 벤치프레스 1세트 휴식", { exact: true }).click();
  await expect(page.locator(".session-overview")).toContainText("0 kg");
  await page.getByLabel("텍스트 내보내기", { exact: true }).click();
  await expect(page.getByLabel("내보낼 운동 기록")).toContainText(
    "맨몸 × 12회 [완료]",
  );
  await page.getByLabel("닫기", { exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("combobox", {
      name: "덤벨 벤치프레스 1세트 맨몸 또는 중량",
      exact: true,
    }),
  ).toHaveValue("bodyweight");
  await expect(page.getByLabel("플랭크 1세트 시간 초")).toHaveValue("45");
});

test("superset rounds rest only after both exercises, remain paired on copy, and share set counts", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "덤벨 벤치프레스");
  await add(page, "원암 덤벨 로우");
  await page
    .getByLabel("덤벨 벤치프레스 슈퍼세트 지정", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /원암 덤벨 로우/ })
    .click();
  await expect(page.locator(".superset-banner")).toHaveCount(2);
  await page
    .locator(".workout-card")
    .first()
    .getByRole("button", { name: "세트 추가 (두 종목)", exact: true })
    .click();
  await expect(page.getByLabel("원암 덤벨 로우 4세트 횟수")).toBeVisible();
  await page.getByLabel("덤벨 벤치프레스 4세트 삭제", { exact: true }).click();
  await expect(page.getByLabel("원암 덤벨 로우 4세트 횟수")).toHaveCount(0);
  await page.getByLabel("덤벨 벤치프레스 휴식 초", { exact: true }).fill("30");
  await expect(
    page.getByLabel("원암 덤벨 로우 휴식 초", { exact: true }),
  ).toHaveValue("30");
  await page.getByLabel("하루 루틴 복사", { exact: true }).click();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await page.locator(".calendar-day").first().click();
  await page.getByRole("button", { name: "선택한 날짜에 붙여넣기" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oun-workout-v1")!),
  );
  const ids = Object.values(saved.days).map(
    (d: any) => d.exercises[0].supersetId,
  );
  expect(new Set(ids).size).toBe(2);
  await page
    .getByRole("button", { name: "전체 운동 시작", exact: true })
    .click();
  await expect(
    page.getByLabel("덤벨 벤치프레스 2세트 완료", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("덤벨 벤치프레스 1세트 완료", { exact: true }).click();
  await expect(page.locator(".rest-timer")).toHaveCount(0);
  await expect(
    page.getByLabel("원암 덤벨 로우 1세트 휴식", { exact: true }),
  ).toBeEnabled();
  await page.getByLabel("원암 덤벨 로우 1세트 휴식", { exact: true }).click();
  await expect(page.locator(".rest-timer")).toBeVisible();
  await page.getByRole("button", { name: "휴식 종료", exact: true }).click();
  await expect(page.locator(".rest-timer")).toHaveCount(0);
  await page.getByLabel("원암 덤벨 로우 2세트 완료", { exact: true }).click();
  await expect(page.locator(".rest-timer")).toHaveCount(0);
  await page.getByLabel("덤벨 벤치프레스 2세트 휴식", { exact: true }).click();
  await expect(page.locator(".rest-timer")).toBeVisible();
  await page.reload();
  await expect(page.locator(".superset-banner")).toHaveCount(2);
  await expect(
    page.getByLabel("덤벨 벤치프레스 3세트 완료", { exact: true }),
  ).toBeEnabled();
});

test("calendar displays planned and trained muscle groups distinctly", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "덤벨 벤치프레스");
  await add(page, "원암 덤벨 로우");
  await add(page, "스쿼트");
  const day = page.locator(".calendar-day.selected");
  await expect(day.locator(".calendar-muscle.planned")).toHaveText([
    "가슴",
    "등",
    "하체",
  ]);
  await page
    .getByRole("button", { name: "전체 운동 시작", exact: true })
    .click();
  await page.getByLabel("덤벨 벤치프레스 1세트 휴식", { exact: true }).click();
  await expect(day.locator(".calendar-muscle.trained")).toHaveText(["가슴"]);
  await expect(day.locator(".calendar-muscle.planned")).toHaveText([
    "등",
    "하체",
  ]);
  await expect(day).toHaveAttribute("aria-label", /가슴 운동함/);
  await page.reload();
  await expect(day.locator(".calendar-muscle.trained")).toHaveText(["가슴"]);
});

test("legacy backup migration preserves records; pair validation and bodyweight totals", () => {
  const raw = initialStore();
  const e = makeExercise(
    catalog.find((e) => e.name === "푸시업")!,
    60,
  );
  delete e.equipment;
  e.sets.forEach((s) => delete s.bodyweight);
  e.sets[0].doneAt = 2000;
  raw.days["2026-10-18"] = {
    ...emptyDay(),
    exercises: [e],
    startedAt: 1000,
    endedAt: 3000,
  };
  const migrated = parseStore(JSON.stringify(raw));
  expect(migrated.days["2026-10-18"].exercises[0].sets[0].bodyweight).toBe(
    true,
  );
  expect(migrated.days["2026-10-18"].endedAt).toBe(3000);
  const day = emptyDay();
  day.exercises = [
    makeExercise(
      catalog.find((e) => e.name === "푸시업")!,
      60,
    ),
    makeExercise(
      catalog.find((e) => e.name === "플랭크")!,
      30,
    ),
  ];
  pairExercises(day, day.exercises[0].id, day.exercises[1].id);
  expect(day.exercises[1].sets).toHaveLength(3);
  expect(day.exercises[1].restSeconds).toBe(60);
  day.startedAt = 1000;
  expect(recordSet(day, day.exercises[0].id, 0, 2000).rest).toBe(false);
  expect(() => recordSet(day, day.exercises[0].id, 1, 2500)).toThrow();
  expect(recordSet(day, day.exercises[1].id, 0, 3000).rest).toBe(true);
  const clone = cloneRoutine(day.exercises);
  expect(clone[0].supersetId).toBe(clone[1].supersetId);
  expect(clone[0].supersetId).not.toBe(day.exercises[0].supersetId);
  raw.days["2026-10-18"] = day;
  const broken = structuredClone(raw);
  broken.days["2026-10-18"].exercises.pop();
  expect(() => parseStore(JSON.stringify(broken))).toThrow(/슈퍼세트/);
});
