import React, { useState, useRef, useEffect } from "react";


const CATS = {
  fast: { label: "패스트푸드", color: "#E8425A", soft: "#FCE2E7" },
  normal: { label: "일반식", color: "#F0637A", soft: "#FDE7EC" },
  healthy: { label: "건강식", color: "#F79BA8", soft: "#FDEEF1" },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 왜 먹었지 — 이유 태그(기본값). 사용자가 직접 추가한 태그는 기록에서 자동으로 합쳐진다.
const REASON_OPTIONS = [
  "배고파서",
  "맛있어 보여서",
  "습관적으로",
  "심심해서",
  "스트레스",
  "사람들과 함께",
  "남기기 아까워서",
  "모르겠음",
];

// 먹기 전 상태
const HUNGER_OPTIONS = ["많이 배고픔", "조금 배고픔", "안 배고픔"];

// 어디서 먹었어 — 출처
const SOURCE_OPTIONS = ["직접 조리", "집밥", "외식", "배달", "편의점", "카페"];

// AI 영양 태그 — 6축. 값은 low/medium/high.
const NUTRIENTS = [
  { key: "protein", label: "단백질" },
  { key: "veggie", label: "채소" },
  { key: "carb", label: "탄수화물" },
  { key: "fat", label: "지방" },
  { key: "sugar", label: "당류" },
  { key: "sodium", label: "나트륨" },
];
const LEVEL_DOTS = { low: 1, medium: 2, high: 3 };

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}
function fmtCardDate(d) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}
function fmtShortDate(d) {
  return `${d.getMonth() + 1}.${d.getDate()} ${WEEKDAYS[d.getDay()]}`;
}

// 특정 달의 달력 셀 배열. 앞뒤 빈칸(null)을 채워 7의 배수로 맞춘다.
function monthMatrix(year, month) {
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// 오늘을 기준으로 target 날짜까지의 '달력상 일수' 차이 (offset 계산용)
function dayOffsetFromToday(today, target) {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

// "YYYY-MM-DD" → 로컬 Date
function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 최근에 먹은 순서로 중복 없는 음식명 (빠른 추가용)
function recentDistinctFoods(logs, limit) {
  const seen = [];
  Object.keys(logs)
    .sort()
    .reverse()
    .forEach((k) => {
      (logs[k] || [])
        .slice()
        .reverse()
        .forEach((f) => {
          if (!seen.includes(f.name)) seen.push(f.name);
        });
    });
  return seen.slice(0, limit);
}

// 모든 기록을 날짜와 함께 펼치고 최신순 정렬 (검색·필터용)
function flattenLogs(logs) {
  const all = [];
  Object.keys(logs).forEach((k) =>
    (logs[k] || []).forEach((f) => all.push({ ...f, key: k }))
  );
  all.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return all;
}

// 음식명 빈도 (자주 먹은 음식)
function foodFrequency(records) {
  const map = {};
  records.forEach((f) => {
    map[f.name] = (map[f.name] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function rowToItem(row) {
  const hasCalories = 
  row.calories_min !== null &&
  row.calories_max !== null &&
  row.calories_estimate !== null;

  return {
    id: row.id,
    name: row.name,
    cat: row.category,

    reason: row.reason ?? null,
    hunger: row.hunger ?? null,
    source: row.source ?? null,
    nutrition: row.nutrition ?? null,

    calorieInfo: hasCalories
    ? {
      calories: {
        min: row.calories_min,
        max:  row.calories_max,
        estimate: row.calories_estimate,
      },
      serving: row.serving,
      confidence: row.confidence,
      accuracy: row.accuracy ?? null,
      note: row.note,
    }
    : null,
  };
}

function groupRowsByDate(rows) {
  return rows.reduce((grouped, row) => {
    const key = row.log_date;

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(rowToItem(row));

    return grouped;
  }, {});
}

function getDisplayNote(note) {
  const text = note?.trim();

  if (!text) {
    return "";
  }

  const genericNotes = [
    "일반적인 제품 기준 추정치입니다.",
    "일반적인 제품의 수치입니다.",
    "일반적인 제품을 기준으로 추정했습니다.",
    "대략적인 추정치입니다.",
  ];

  return genericNotes.includes(text) ? "" : text;
}

// 정확도(%)를 우선 사용하고, 옛 기록처럼 accuracy가 없으면 confidence로 근사한다.
function getAccuracy(info) {
  if (!info) return null;

  if (Number.isFinite(info.accuracy)) {
    return info.accuracy;
  }

  const fallback = { high: 90, medium: 68, low: 40 };
  return fallback[info.confidence] ?? null;
}

// 월간 회고: 서버에 이번 달 기록을 보내 '발견' 목록을 받는다.
async function fetchReview({ monthLabel, records, prevRatio }) {
  const res = await fetch("/api/retrospect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monthLabel, records, prevRatio }),
  });

  if (!res.ok) {
    throw new Error(`회고 요청 실패: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data.discoveries) ? data.discoveries : [];
}

// 회고는 기록이 바뀌지 않으면 재생성하지 않도록 localStorage 에 시그니처와 함께 캐시한다.
function readReviewCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeReviewCache(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // 저장 실패(프라이빗 모드 등)는 조용히 무시
  }
}

async function classifyFood(name) {
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      throw new Error(`분류 요청 실패: ${res.status}`);
    }

    const data = await res.json();

    const allowed = ["fast", "normal", "healthy"];

    return allowed.includes(data.category)
      ? data.category
      : "normal";
  } catch (error) {
    console.error("분류 요청 오류:", error);
    return "normal";
  }
}

async function estimateCalories(name) {
  try {
    const res = await fetch("/api/calories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      throw new Error(`칼로리 요청 실패: ${res.status}`);
    }

    const data = await res.json();

    return {
      calories: data.calories,
      serving: data.serving,
      confidence: data.confidence,
      accuracy: data.accuracy ?? null,
      note: data.note,
    };
  } catch (error) {
    console.error("칼로리 추정 오류:", error);

    return null;
  }
}

async function estimateNutrition(name) {
  try {
    const res = await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      throw new Error(`영양 추정 실패: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("영양 추정 오류:", error);

    return null;
  }
}

export default function FoodLogWeb() {
  const [today] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  const [logs, setLogs] = useState({});
  const [logsLoading, setLogsLoading] = useState(true);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [anim, setAnim] = useState("");

  // 칩 UI: 어떤 기록의 태그 편집창이 열려있는지 (id)
  const [activeChipId, setActiveChipId] = useState(null);

  // 화면 모드: 일별 / 월간, 그리고 월간에서 보고 있는 달(오늘 기준 개월 오프셋)
  const [view, setView] = useState("day");
  const [monthOffset, setMonthOffset] = useState(0);

  const monthCursor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  function pickDay(target) {
    setOffset(dayOffsetFromToday(today, target));
    setView("day");
    setActiveChipId(null);
  }

  const curDate = addDays(today, offset);
  const curKey = dateKey(curDate);
  const items = logs[curKey] || [];

  function go(delta) {
    setAnim(delta > 0 ? "left" : "right");
    setOffset((o) => o + delta);
    setTimeout(() => setAnim(""), 240);
  }

  useEffect(() => {
    let ignore = false;

    async function loadLogs() {
      try {
        const res = await fetch("/api/logs");

        if (!res.ok) {
          throw new Error(`기록 조회 실패: ${res.status}`);
        }

        const rows = await res.json();

        if (!ignore) {
          setLogs(groupRowsByDate(rows));
        }
      } catch (error) {
        console.error("식단 기록 조회 오류:", error);
      } finally {
        if (!ignore) {
          setLogsLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 음식 하나를 분류·칼로리·영양 추정과 함께 저장한다. addFood/빠른 추가에서 공용.
  async function addFoodByName(name, { targetKey = curKey, openChips = true } = {}) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const [cat, calorieInfo, nutrition] = await Promise.all([
      classifyFood(trimmed),
      estimateCalories(trimmed),
      estimateNutrition(trimmed),
    ]);

    const saveRes = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate: targetKey,
        name: trimmed,
        category: cat,
        calorieInfo,
        nutrition,
      }),
    });

    const savedRow = await saveRes.json();

    if (!saveRes.ok) {
      throw new Error(
        savedRow.detail || savedRow.error || `기록 저장 실패: ${saveRes.status}`
      );
    }

    const savedItem = rowToItem(savedRow);

    setLogs((prev) => ({
      ...prev,
      [targetKey]: [...(prev[targetKey] || []), savedItem],
    }));

    if (openChips) setActiveChipId(savedItem.id);

    return savedItem;
  }

  async function addFood() {
    const name = input.trim();
    if (!name || busy) return;

    setBusy(true);
    try {
      await addFoodByName(name);
      setInput("");
    } catch (error) {
      console.error("음식 기록 추가 오류:", error);
    } finally {
      setBusy(false);
    }
  }

  // 빠른 추가: 최근 먹은 음식 칩을 한 번 탭해서 그대로 추가
  async function quickAdd(name) {
    if (busy) return;
    setBusy(true);
    try {
      await addFoodByName(name);
    } catch (error) {
      console.error("빠른 추가 오류:", error);
    } finally {
      setBusy(false);
    }
  }

  // 어제(현재 보고 있는 날의 전날)와 동일하게 추가
  async function repeatYesterday() {
    if (busy) return;
    const yItems = logs[dateKey(addDays(curDate, -1))] || [];
    if (yItems.length === 0) return;

    setBusy(true);
    try {
      for (const it of yItems) {
        await addFoodByName(it.name, { openChips: false });
      }
    } catch (error) {
      console.error("어제와 동일 추가 오류:", error);
    } finally {
      setBusy(false);
    }
  }

  async function removeFood(id) {
    try {
      const res = await fetch(`/api/logs/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let result = {};

        try {
          result = await res.json();
        } catch {
          // 응답 본문이 없는 경우
        }

        throw new Error(
          result.detail ||
          result.error ||
          `기록 삭제 실패: ${res.status}`
        );
      }

      setLogs((prev) => ({
        ...prev,
        [curKey]: (prev[curKey] || []).filter((food) => food.id !== id),
      }));
    } catch (error) {
      console.error("음식 기록 삭제 오류:", error);
    }
  }

  // 기록의 태그(reason/hunger/source)를 갱신한다. 같은 값을 다시 누르면 선택 해제.
  async function updateFoodTag(id, field, value) {
    const current = items.find((f) => f.id === id);
    const next = current?.[field] === value ? null : value;

    // 낙관적 업데이트
    setLogs((prev) => ({
      ...prev,
      [curKey]: (prev[curKey] || []).map((f) =>
        f.id === id ? { ...f, [field]: next } : f
      ),
    }));

    try {
      const res = await fetch(`/api/logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });

      if (!res.ok) {
        throw new Error(`태그 저장 실패: ${res.status}`);
      }
    } catch (error) {
      console.error("태그 업데이트 오류:", error);

      // 실패 시 이전 값으로 되돌린다.
      setLogs((prev) => ({
        ...prev,
        [curKey]: (prev[curKey] || []).map((f) =>
          f.id === id ? { ...f, [field]: current?.[field] ?? null } : f
        ),
      }));
    }
  }

  // 전체 기록에서 최근에 고른 값을 앞에 둔다. base 옵션과 사용자가 직접 넣은 값을 합친다.
  function orderedTagOptions(field, base) {
    const seen = [];
    Object.keys(logs)
      .sort()
      .reverse()
      .forEach((k) =>
        (logs[k] || []).forEach((f) => {
          const v = f[field];
          if (v && !seen.includes(v)) seen.push(v);
        })
      );
    const merged = [...seen];
    base.forEach((v) => {
      if (!merged.includes(v)) merged.push(v);
    });
    return merged;
  }

  function weekStats() {
    const base = addDays(today, offset);
    const sunday = addDays(base, -base.getDay());
    return WEEKDAYS.map((wd, i) => {
      const d = addDays(sunday, i);
      const dayItems = logs[dateKey(d)] || [];
      const counts = { fast: 0, normal: 0, healthy: 0 };
      dayItems.forEach((it) => (counts[it.cat] += 1));
      return {
        wd,
        d,
        counts,
        total: dayItems.length,
        isCurrent: dateKey(d) === curKey,
        isToday: dateKey(d) === dateKey(today),
      };
    });
  }
  const week = weekStats();
  const maxTotal = Math.max(1, ...week.map((w) => w.total));

  // 빠른 추가: 최근 음식 + 어제와 동일
  const recentFoods = recentDistinctFoods(logs, 8);
  const hasYesterday = (logs[dateKey(addDays(curDate, -1))] || []).length > 0;

  return (
    <div style={S.page}>
      <style>{css}</style>
      <div style={S.shell}>
        {/* 헤더 */}
        <header style={S.header}>
          <div style={S.logo}>
            <span style={S.logoMark}>🍒</span> 왜 먹었지
          </div>
          <div style={S.sub}>먹은 걸 적으면 AI가 알아서 분류해요</div>
        </header>

        {/* 일별 / 월간 전환 */}
        <div style={S.viewToggle}>
          {[
            ["day", "일별"],
            ["month", "월간"],
            ["search", "찾기"],
          ].map(([key, label]) => (
            <button
              key={key}
              style={{
                ...S.viewTab,
                ...(view === key ? S.viewTabOn : {}),
              }}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "month" ? (
          <MonthView
            logs={logs}
            year={monthCursor.getFullYear()}
            month={monthCursor.getMonth()}
            today={today}
            onPrev={() => setMonthOffset((m) => m - 1)}
            onNext={() => setMonthOffset((m) => m + 1)}
            onThisMonth={() => setMonthOffset(0)}
            onPickDay={pickDay}
          />
        ) : view === "search" ? (
          <SearchView logs={logs} onPickDay={pickDay} />
        ) : (
        /* 2단 레이아웃 */
        <div style={S.grid}>
          {/* ── 왼쪽: 데이 카드 ── */}
          <section style={S.leftCol}>
            <div style={S.dateNav}>
              <button style={S.arrow} onClick={() => go(-1)} aria-label="전날">
                ‹
              </button>
              <div style={S.dateLabel}>
                <div style={S.dateMain}>{fmtCardDate(curDate)}</div>
                {offset === 0 && <span style={S.todayBadge}>오늘</span>}
                {offset !== 0 && (
                  <button style={S.toToday} onClick={() => setOffset(0)}>
                    오늘로
                  </button>
                )}
              </div>
              <button style={S.arrow} onClick={() => go(1)} aria-label="다음날">
                ›
              </button>
            </div>

            <div style={S.card} className={anim ? `sw-${anim}` : ""}>
              {items.length === 0 ? (
                <div style={S.empty}>
                  아직 기록이 없어요.
                  <br />
                  먹은 음식을 아래에 적어보세요.
                </div>
              ) : (
                <ul style={S.list}>
                    {items.map((f) => (
                      <FoodItem
                        key={f.id}
                        f={f}
                        open={activeChipId === f.id}
                        onToggleChips={() =>
                          setActiveChipId((cur) => (cur === f.id ? null : f.id))
                        }
                        onRemove={() => removeFood(f.id)}
                        onTag={updateFoodTag}
                        reasonOptions={orderedTagOptions("reason", REASON_OPTIONS)}
                        sourceOptions={orderedTagOptions("source", SOURCE_OPTIONS)}
                      />
                    ))}
                </ul>
              )}
            </div>

            {(recentFoods.length > 0 || hasYesterday) && (
              <div style={S.quickAdd}>
                <span style={S.quickLabel}>빠른 추가</span>
                {hasYesterday && (
                  <button
                    style={{ ...S.chip, ...S.quickRepeat }}
                    onClick={repeatYesterday}
                    disabled={busy}
                  >
                    ⟳ 어제와 동일
                  </button>
                )}
                {recentFoods.map((name) => (
                  <button
                    key={name}
                    style={S.chip}
                    onClick={() => quickAdd(name)}
                    disabled={busy}
                    title={`${name} 추가`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            <div style={S.inputBar}>
              <input
                style={S.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFood()}
                placeholder="예: 불고기버거, 김치찌개, 닭가슴살 샐러드…"
                disabled={busy}
              />
              <button style={S.addBtn} onClick={addFood} disabled={busy}>
                {busy ? "분류중…" : "추가"}
              </button>
            </div>
            <div style={S.kbdHint}>← → 키로 날짜를 넘길 수 있어요</div>
          </section>

          {/* ── 오른쪽: 주간 분석 ── */}
          <section style={S.rightCol}>
            <div style={S.panelTitle}>이번 주 식단</div>
            <div style={S.legend}>
              {Object.entries(CATS).map(([k, v]) => (
                <span key={k} style={S.legendItem}>
                  <span style={{ ...S.dot, background: v.color }} /> {v.label}
                </span>
              ))}
            </div>

            <div style={S.chart}>
              {week.map((w, i) => (
                <div key={i} style={S.barCol}>
                  <div style={S.barTrack}>
                    <div style={S.barStack}>
                      {w.total === 0 ? (
                        <div style={S.barEmpty} />
                      ) : (
                        ["fast", "normal", "healthy"].map((c) =>
                          w.counts[c] > 0 ? (
                            <div
                              key={c}
                              style={{
                                height: `${(w.counts[c] / maxTotal) * 100}%`,
                                background: CATS[c].color,
                              }}
                              title={`${CATS[c].label} ${w.counts[c]}`}
                            />
                          ) : null
                        )
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      ...S.barLabel,
                      ...(w.isCurrent ? S.barLabelCur : {}),
                    }}
                  >
                    {w.wd}
                  </div>
                </div>
              ))}
            </div>

            <WeekSummary week={week} />
          </section>
        </div>
        )}
      </div>
    </div>
  );
}

function SearchView({ logs, onPickDay }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [source, setSource] = useState("all");
  const [reason, setReason] = useState("all");

  const all = flattenLogs(logs);
  const sources = [...new Set(all.map((f) => f.source).filter(Boolean))];
  const reasons = [...new Set(all.map((f) => f.reason).filter(Boolean))];
  const topFoods = foodFrequency(all).slice(0, 6);

  const q = query.trim().toLowerCase();
  const results = all.filter(
    (f) =>
      (!q || f.name.toLowerCase().includes(q)) &&
      (cat === "all" || f.cat === cat) &&
      (source === "all" || f.source === source) &&
      (reason === "all" || f.reason === reason)
  );

  // 검색어가 있으면 통계 한 줄 (총 횟수 + 주로 무슨 요일)
  let stat = null;
  if (q && results.length > 0) {
    const wdCount = {};
    results.forEach((f) => {
      const wd = WEEKDAYS[keyToDate(f.key).getDay()];
      wdCount[wd] = (wdCount[wd] || 0) + 1;
    });
    const topWd = Object.entries(wdCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    stat = `'${query.trim()}' 총 ${results.length}번${
      topWd ? ` · 주로 ${topWd}요일` : ""
    }`;
  }

  const catFilters = [
    ["all", "전체"],
    ["fast", CATS.fast.label],
    ["normal", CATS.normal.label],
    ["healthy", CATS.healthy.label],
  ];

  const fchip = (on) => ({ ...S.filterChip, ...(on ? S.filterChipOn : {}) });

  return (
    <div style={S.searchWrap}>
      <input
        style={S.searchInput}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="음식 이름으로 검색…"
      />

      {topFoods.length > 0 && (
        <div style={S.searchSection}>
          <div style={S.searchSectionLabel}>자주 먹은 음식</div>
          <div style={S.chipRow}>
            {topFoods.map((t) => (
              <button
                key={t.name}
                style={S.chip}
                onClick={() => setQuery(t.name)}
              >
                {t.name} <span style={S.freqCount}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={S.filterRow}>
        {catFilters.map(([k, l]) => (
          <button key={k} style={fchip(cat === k)} onClick={() => setCat(k)}>
            {l}
          </button>
        ))}
      </div>

      {sources.length > 0 && (
        <div style={S.filterRow}>
          <button
            style={fchip(source === "all")}
            onClick={() => setSource("all")}
          >
            출처 전체
          </button>
          {sources.map((s) => (
            <button
              key={s}
              style={fchip(source === s)}
              onClick={() => setSource(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {reasons.length > 0 && (
        <div style={S.filterRow}>
          <button
            style={fchip(reason === "all")}
            onClick={() => setReason("all")}
          >
            이유 전체
          </button>
          {reasons.map((r) => (
            <button
              key={r}
              style={fchip(reason === r)}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {stat && <div style={S.searchStat}>{stat}</div>}
      <div style={S.searchCount}>{results.length}개 기록</div>

      {results.length === 0 ? (
        <div style={S.searchEmpty}>
          {all.length === 0
            ? "아직 기록이 없어요."
            : "조건에 맞는 기록이 없어요."}
        </div>
      ) : (
        <ul style={S.resultList}>
          {results.map((f) => (
            <li key={f.id} style={S.resultRow}>
              <button
                style={S.resultBtn}
                onClick={() => onPickDay(keyToDate(f.key))}
              >
                <span style={S.resultDate}>
                  {fmtShortDate(keyToDate(f.key))}
                </span>
                <span style={S.resultName}>{f.name}</span>
                <span
                  style={{
                    ...S.badge,
                    background: CATS[f.cat].soft,
                    color: CATS[f.cat].color,
                  }}
                >
                  {CATS[f.cat].label}
                </span>
              </button>
              {(f.source || f.reason) && (
                <div style={S.resultTags}>
                  {f.source && <span style={S.tagPill}>{f.source}</span>}
                  {f.reason && <span style={S.tagPill}>{f.reason}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonthView({ logs, year, month, today, onPrev, onNext, onThisMonth, onPickDay }) {
  const cells = monthMatrix(year, month);
  const todayKey = dateKey(today);
  const isThisMonth =
    year === today.getFullYear() && month === today.getMonth();

  // 이번 달 합계 + 회고에 넘길 기록 목록
  const tot = { fast: 0, normal: 0, healthy: 0 };
  const monthRecords = [];
  cells.forEach((d) => {
    if (!d) return;
    (logs[dateKey(d)] || []).forEach((f) => {
      if (tot[f.cat] != null) tot[f.cat] += 1;
      monthRecords.push({
        id: f.id,
        name: f.name,
        category: f.cat,
        reason: f.reason,
        source: f.source,
        hunger: f.hunger,
        weekday: WEEKDAYS[d.getDay()],
      });
    });
  });
  const sum = tot.fast + tot.normal + tot.healthy;
  const pct = (n) => (sum ? Math.round((n / sum) * 100) : 0);

  // 지난달 분류 비율 (회고에서 "지난달보다 ~" 비교에 사용)
  const prevY = month === 0 ? year - 1 : year;
  const prevM = month === 0 ? 11 : month - 1;
  const prevCounts = { fast: 0, normal: 0, healthy: 0 };
  monthMatrix(prevY, prevM).forEach((d) => {
    if (!d) return;
    (logs[dateKey(d)] || []).forEach((f) => {
      if (prevCounts[f.cat] != null) prevCounts[f.cat] += 1;
    });
  });
  const prevSum = prevCounts.fast + prevCounts.normal + prevCounts.healthy;
  const prevRatio = prevSum
    ? {
        fast: Math.round((prevCounts.fast / prevSum) * 100),
        normal: Math.round((prevCounts.normal / prevSum) * 100),
        healthy: Math.round((prevCounts.healthy / prevSum) * 100),
      }
    : null;

  return (
    <div style={S.monthWrap}>
      <div style={S.monthNav}>
        <button style={S.arrow} onClick={onPrev} aria-label="이전 달">
          ‹
        </button>
        <div style={S.monthLabel}>
          <div style={S.monthTitle}>
            {year}년 {month + 1}월
          </div>
          {!isThisMonth && (
            <button style={S.toToday} onClick={onThisMonth}>
              이번 달
            </button>
          )}
        </div>
        <button style={S.arrow} onClick={onNext} aria-label="다음 달">
          ›
        </button>
      </div>

      {sum === 0 ? (
        <div style={S.monthSummaryEmpty}>이 달엔 아직 기록이 없어요.</div>
      ) : (
        <div style={S.monthSummary}>
          <span style={S.monthTotal}>기록 {sum}개</span>
          {["healthy", "normal", "fast"].map((c) => (
            <span key={c} style={S.monthStat}>
              <span style={{ ...S.dot, background: CATS[c].color }} />
              {CATS[c].label} {pct(tot[c])}%
            </span>
          ))}
        </div>
      )}

      <div style={S.calGrid}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} style={S.calWeekday}>
            {wd}
          </div>
        ))}

        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} style={S.calEmpty} />;

          const key = dateKey(d);
          const dayItems = logs[key] || [];
          const counts = { fast: 0, normal: 0, healthy: 0 };
          dayItems.forEach((f) => {
            if (counts[f.cat] != null) counts[f.cat] += 1;
          });
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              style={{
                ...S.calCell,
                ...(isToday ? S.calCellToday : {}),
              }}
              onClick={() => onPickDay(d)}
            >
              <span
                style={{
                  ...S.calDate,
                  ...(isToday ? S.calDateToday : {}),
                }}
              >
                {d.getDate()}
              </span>

              {dayItems.length > 0 && (
                <>
                  <span style={S.calDots}>
                    {["fast", "normal", "healthy"].map((c) =>
                      counts[c] > 0 ? (
                        <span
                          key={c}
                          style={{ ...S.calDot, background: CATS[c].color }}
                        />
                      ) : null
                    )}
                  </span>
                  <span style={S.calCount}>{dayItems.length}개</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <MonthReview
        monthKey={`${year}-${month + 1}`}
        monthLabel={`${year}년 ${month + 1}월`}
        records={monthRecords}
        prevRatio={prevRatio}
      />
    </div>
  );
}

function MonthReview({ monthKey, monthLabel, records, prevRatio }) {
  const cacheKey = `wdie-review:${monthKey}`;
  // 기록/태그가 바뀌면 시그니처가 달라져 재생성된다.
  const signature = records
    .map((r) => `${r.id}:${r.reason || ""}:${r.source || ""}:${r.hunger || ""}`)
    .join("|");

  const [status, setStatus] = useState("idle"); // idle|few|loading|done|error
  const [discoveries, setDiscoveries] = useState([]);

  useEffect(() => {
    let ignore = false;

    if (records.length < 3) {
      setStatus("few");
      setDiscoveries([]);
      return;
    }

    const cached = readReviewCache(cacheKey);
    if (cached && cached.signature === signature) {
      setDiscoveries(cached.discoveries);
      setStatus("done");
      return;
    }

    setStatus("loading");
    fetchReview({ monthLabel, records, prevRatio })
      .then((d) => {
        if (ignore) return;
        writeReviewCache(cacheKey, { signature, discoveries: d });
        setDiscoveries(d);
        setStatus("done");
      })
      .catch((err) => {
        if (ignore) return;
        console.error("월간 회고 조회 오류:", err);
        setStatus("error");
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, signature]);

  async function regenerate() {
    setStatus("loading");
    try {
      const d = await fetchReview({ monthLabel, records, prevRatio });
      writeReviewCache(cacheKey, { signature, discoveries: d });
      setDiscoveries(d);
      setStatus("done");
    } catch (err) {
      console.error("월간 회고 재생성 오류:", err);
      setStatus("error");
    }
  }

  return (
    <div style={S.reviewCard}>
      <div style={S.reviewHead}>
        <span style={S.reviewTitle}>✨ 이번 달 발견</span>
        {status === "done" && (
          <button style={S.reviewRefresh} onClick={regenerate}>
            다시 생성
          </button>
        )}
      </div>

      {status === "few" && (
        <div style={S.reviewMuted}>
          기록이 3개 이상 쌓이면 AI가 이번 달 패턴을 찾아줘요.
        </div>
      )}

      {status === "loading" && (
        <div style={S.reviewMuted}>AI가 이번 달 기록을 살펴보는 중…</div>
      )}

      {status === "error" && (
        <div style={S.reviewMuted}>
          지금은 발견을 불러오지 못했어요.{" "}
          <button style={S.reviewRetry} onClick={regenerate}>
            다시 시도
          </button>
        </div>
      )}

      {status === "done" &&
        (discoveries.length > 0 ? (
          <ul style={S.reviewList}>
            {discoveries.map((d, i) => (
              <li key={i} style={S.reviewItem}>
                <span style={S.reviewBullet}>•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={S.reviewMuted}>뚜렷한 패턴을 찾지 못했어요.</div>
        ))}
    </div>
  );
}

function FoodItem({
  f,
  open,
  onToggleChips,
  onRemove,
  onTag,
  reasonOptions,
  sourceOptions,
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");

  const info = f.calorieInfo;
  const note = getDisplayNote(info?.note);
  const accuracy = getAccuracy(info);

  // 편집창이 닫혀있을 때 보여줄 선택된 태그 요약
  const summary = [f.reason, f.source, f.hunger].filter(Boolean);

  function submitCustom() {
    const v = customText.trim();
    if (v) onTag(f.id, "reason", v);
    setCustomText("");
    setCustomOpen(false);
  }

  return (
    <li style={S.foodRow}>
      <div style={S.foodTop}>
        <span style={S.foodName}>{f.name}</span>

        <span style={S.rowRight}>
          <span
            style={{
              ...S.badge,
              background: CATS[f.cat].soft,
              color: CATS[f.cat].color,
            }}
          >
            {CATS[f.cat].label}
          </span>

          <button style={S.del} onClick={onRemove} aria-label="삭제">
            ×
          </button>
        </span>
      </div>

      {info && (
        <div style={S.aiAnswer}>
          <div style={S.calorieLine}>
            <strong style={S.calorieEstimate}>
              약 {info.calories.estimate.toLocaleString()} kcal
            </strong>

            {info.serving && <span style={S.serving}>· {info.serving}</span>}
          </div>

          <div style={S.calorieMeta}>
            <span>
              예상 범위 {info.calories.min.toLocaleString()}
              {"–"}
              {info.calories.max.toLocaleString()} kcal
            </span>

            {accuracy != null && (
              <>
                <span style={S.metaDivider}>·</span>
                <span>정확도 {accuracy}%</span>
              </>
            )}
          </div>

          {note && (
            <div style={S.aiNote}>
              <span style={S.aiMark}>AI</span>
              <span>{note}</span>
            </div>
          )}
        </div>
      )}

      {/* AI 영양 태그 */}
      {f.nutrition && (
        <div style={S.nutriBox}>
          <div style={S.nutriGrid}>
            {NUTRIENTS.map((n) => {
              const dots = LEVEL_DOTS[f.nutrition[n.key]] || 0;
              return (
                <div key={n.key} style={S.nutriItem}>
                  <span style={S.nutriLabel}>{n.label}</span>
                  <span style={S.nutriDots}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          ...S.nutriDot,
                          ...(i < dots ? S.nutriDotOn : {}),
                        }}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>

          {f.nutrition.tip && (
            <div style={S.aiNote}>
              <span style={S.aiMark}>AI</span>
              <span>{f.nutrition.tip}</span>
            </div>
          )}

          <div style={S.nutriDisc}>이 식사만 기준으로 한 대략적인 분석이야.</div>
        </div>
      )}

      {/* 태그 요약 / 편집 토글 */}
      <div style={S.tagBar}>
        {summary.length > 0 && !open && (
          <span style={S.tagSummary}>
            {summary.map((t, i) => (
              <span key={i} style={S.tagPill}>
                {t}
              </span>
            ))}
          </span>
        )}
        <button style={S.tagToggle} onClick={onToggleChips}>
          {open ? "접기" : summary.length > 0 ? "태그 수정" : "왜 먹었지?"}
        </button>
      </div>

      {open && (
        <div style={S.chipPanel}>
          <ChipGroup
            label="왜 먹었지?"
            options={reasonOptions}
            value={f.reason}
            onPick={(v) => onTag(f.id, "reason", v)}
            extra={
              customOpen ? (
                <input
                  autoFocus
                  style={S.customInput}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCustom();
                    if (e.key === "Escape") {
                      setCustomText("");
                      setCustomOpen(false);
                    }
                  }}
                  onBlur={submitCustom}
                  placeholder="직접 입력"
                />
              ) : (
                <button
                  style={S.chip}
                  onClick={() => setCustomOpen(true)}
                >
                  + 직접
                </button>
              )
            }
          />

          <ChipGroup
            label="어디서 먹었어?"
            options={sourceOptions}
            value={f.source}
            onPick={(v) => onTag(f.id, "source", v)}
          />

          <ChipGroup
            label="먹기 전 상태"
            options={HUNGER_OPTIONS}
            value={f.hunger}
            onPick={(v) => onTag(f.id, "hunger", v)}
          />
        </div>
      )}
    </li>
  );
}

function ChipGroup({ label, options, value, onPick, extra }) {
  return (
    <div style={S.chipGroup}>
      <div style={S.chipLabel}>{label}</div>
      <div style={S.chipRow}>
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              style={{ ...S.chip, ...(on ? S.chipOn : {}) }}
              onClick={() => onPick(opt)}
            >
              {opt}
            </button>
          );
        })}
        {extra}
      </div>
    </div>
  );
}

function WeekSummary({ week }) {
  const tot = { fast: 0, normal: 0, healthy: 0 };
  week.forEach((w) =>
    ["fast", "normal", "healthy"].forEach((c) => (tot[c] += w.counts[c]))
  );
  const sum = tot.fast + tot.normal + tot.healthy;
  if (sum === 0)
    return (
      <div style={S.summaryEmpty}>
        기록이 쌓이면 여기에 이번 주 비율이 나와요.
      </div>
    );
  const pct = (n) => Math.round((n / sum) * 100);
  return (
    <div style={S.summary}>
      <div style={S.summaryHead}>이번 주 총 {sum}끼</div>
      <div style={S.summaryBars}>
        {["fast", "normal", "healthy"].map((c) => (
          <div key={c} style={S.summaryLine}>
            <span style={S.summaryLabel}>{CATS[c].label}</span>
            <div style={S.summaryTrack}>
              <div
                style={{
                  width: `${pct(tot[c])}%`,
                  background: CATS[c].color,
                  height: "100%",
                  borderRadius: 6,
                }}
              />
            </div>
            <span style={S.summaryPct}>{pct(tot[c])}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const css = `
@keyframes slL { from { transform: translateX(30px); opacity:.35 } to { transform: translateX(0); opacity:1 } }
@keyframes slR { from { transform: translateX(-30px); opacity:.35 } to { transform: translateX(0); opacity:1 } }
.sw-left { animation: slL .24s ease }
.sw-right { animation: slR .24s ease }
`;

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #FFF5F7 0%, #FDEBF0 100%)",
    fontFamily: "'Pretendard', -apple-system, system-ui, sans-serif",
    color: "#43222A",
    padding: "40px 24px",
    boxSizing: "border-box",
  },
  shell: { maxWidth: 1040, margin: "0 auto" },

  header: { marginBottom: 28 },
  logo: {
    fontFamily: "'Jua', 'Pretendard', sans-serif",
    fontSize: 30,
    fontWeight: 400,
    letterSpacing: "0.2px",
    color: "#E8425A",
  },
  logoMark: { fontFamily: "'Pretendard', sans-serif", marginRight: 8 },
  sub: { marginTop: 6, fontSize: 14, color: "#B0707E" },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    alignItems: "start",
  },

  // 왼쪽
  leftCol: {},
  dateNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    border: "none",
    background: "#fff",
    boxShadow: "0 4px 14px rgba(232,66,90,0.14)",
    fontSize: 22,
    color: "#E8425A",
    cursor: "pointer",
    lineHeight: 1,
  },
  dateLabel: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  dateMain: { fontSize: 18, fontWeight: 800 },
  todayBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    background: "#F0637A",
    padding: "2px 11px",
    borderRadius: 10,
  },
  toToday: {
    fontSize: 11,
    fontWeight: 700,
    color: "#E8425A",
    background: "#FCE2E7",
    border: "none",
    padding: "3px 11px",
    borderRadius: 10,
    cursor: "pointer",
  },

  card: {
    background: "#fff",
    borderRadius: 22,
    minHeight: 340,
    padding: "8px 6px",
    boxShadow: "0 14px 38px rgba(232,66,90,0.10)",
    border: "1px solid #FBDCE3",
  },
  empty: {
    textAlign: "center",
    color: "#D0A3AD",
    padding: "110px 20px",
    lineHeight: 1.7,
    fontSize: 14.5,
  },
  list: { listStyle: "none", margin: 0, padding: 0 },
  foodRow: {
    padding: "14px 16px",
    borderBottom: "1px solid #FBEEF1",
  },
  foodTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  foodName: {
    fontSize: 15.5,
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowRight: { display: "flex", alignItems: "center", gap: 9, flexShrink: 0 },
  badge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 12px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  del: {
    border: "none",
    background: "none",
    color: "#E0B4BD",
    fontSize: 20,
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 2px",
  },
  aiAnswer: {
    marginTop: 10,
    padding: "11px 13px",
    borderRadius: 13,
    background: "#FFF7F9",
    border: "1px solid #FBE7EC",
  },

  calorieLine: {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 5,
  },

  calorieEstimate: {
    fontSize: 15,
    color: "#D93B55",
  },

  serving: {
    fontSize: 13,
    color: "#8F626C",
  },

  calorieMeta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    fontSize: 11.5,
    color: "#B17F89",
  },

  metaDivider: {
    margin: "0 5px",
  },

  aiNote: {
    display: "flex",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 9,
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "#754852",
  },

  aiMark: {
    flexShrink: 0,
    marginTop: 1,
    padding: "1px 6px",
    borderRadius: 7,
    background: "#F8DDE4",
    color: "#D94B63",
    fontSize: 10,
    fontWeight: 800,
  },
  // 일별/월간 전환 세그먼트
  viewToggle: {
    display: "inline-flex",
    gap: 4,
    padding: 4,
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #FBDCE3",
    boxShadow: "0 6px 18px rgba(232,66,90,0.08)",
    marginBottom: 20,
  },
  viewTab: {
    border: "none",
    background: "none",
    color: "#B0707E",
    fontSize: 14,
    fontWeight: 700,
    padding: "8px 22px",
    borderRadius: 11,
    cursor: "pointer",
  },
  viewTabOn: { background: "#E8425A", color: "#fff" },

  // 월간 화면
  monthWrap: {
    background: "#fff",
    borderRadius: 22,
    padding: "22px 22px 26px",
    boxShadow: "0 14px 38px rgba(232,66,90,0.08)",
    border: "1px solid #FBDCE3",
  },
  monthNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  monthLabel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  monthTitle: { fontSize: 19, fontWeight: 800 },
  monthSummary: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    padding: "12px 14px",
    background: "#FFF7F9",
    border: "1px solid #FBE7EC",
    borderRadius: 13,
    marginBottom: 16,
    fontSize: 13,
    color: "#8A5A64",
  },
  monthSummaryEmpty: {
    padding: "12px 14px",
    background: "#FFF7F9",
    border: "1px solid #FBE7EC",
    borderRadius: 13,
    marginBottom: 16,
    fontSize: 13,
    color: "#C99AA4",
    textAlign: "center",
  },
  monthTotal: { fontWeight: 800, color: "#43222A", fontSize: 14 },
  monthStat: { display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },

  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
  },
  calWeekday: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#B0707E",
    padding: "2px 0 6px",
  },
  calEmpty: { aspectRatio: "1 / 1" },
  calCell: {
    aspectRatio: "1 / 1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    padding: "7px 2px 4px",
    border: "1px solid #FBEEF1",
    borderRadius: 12,
    background: "#fff",
    cursor: "pointer",
    overflow: "hidden",
  },
  calCellToday: { borderColor: "#F0637A", background: "#FFF3F6" },
  calDate: { fontSize: 13, fontWeight: 700, color: "#6A3A44", lineHeight: 1 },
  calDateToday: { color: "#E8425A" },
  calDots: { display: "flex", gap: 3, marginTop: 2 },
  calDot: { width: 6, height: 6, borderRadius: 3, display: "inline-block" },
  calCount: { fontSize: 10.5, color: "#A87E88", fontWeight: 600 },

  // 월간 AI 회고 카드
  reviewCard: {
    marginTop: 18,
    padding: "16px 18px",
    borderRadius: 16,
    background: "linear-gradient(160deg, #FFF1F5 0%, #FDE7EF 100%)",
    border: "1px solid #F8D3DD",
  },
  reviewHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reviewTitle: { fontSize: 15, fontWeight: 800, color: "#C0304A" },
  reviewRefresh: {
    fontSize: 12,
    fontWeight: 700,
    color: "#C77E8B",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
  },
  reviewRetry: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#E8425A",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  reviewMuted: { fontSize: 13, color: "#B0707E", lineHeight: 1.6 },
  reviewList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },
  reviewItem: {
    display: "flex",
    gap: 8,
    fontSize: 13.5,
    lineHeight: 1.55,
    color: "#5A2E38",
  },
  reviewBullet: { color: "#E8425A", fontWeight: 800, flexShrink: 0 },

  // AI 영양 태그
  nutriBox: {
    marginTop: 8,
    padding: "11px 13px",
    borderRadius: 13,
    background: "#FCF7F8",
    border: "1px solid #F3E4E8",
  },
  nutriGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    rowGap: 8,
    columnGap: 10,
  },
  nutriItem: { display: "flex", alignItems: "center", gap: 6 },
  nutriLabel: { fontSize: 11.5, color: "#8A5A64", fontWeight: 600 },
  nutriDots: { display: "flex", gap: 3 },
  nutriDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    background: "#EFDADF",
    display: "inline-block",
  },
  nutriDotOn: { background: "#E8637A" },
  nutriDisc: { marginTop: 8, fontSize: 11, color: "#C0929B" },

  // 빠른 추가 strip
  quickAdd: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#8A5A64",
    marginRight: 2,
  },
  quickRepeat: {
    color: "#D93B55",
    borderColor: "#F5B9C4",
    fontWeight: 700,
  },

  // 찾기(검색·필터) 화면
  searchWrap: {
    background: "#fff",
    borderRadius: 22,
    padding: "22px 22px 26px",
    boxShadow: "0 14px 38px rgba(232,66,90,0.08)",
    border: "1px solid #FBDCE3",
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    borderRadius: 14,
    border: "1.5px solid #F5CDD6",
    fontSize: 15,
    outline: "none",
    background: "#fff",
  },
  searchSection: { marginTop: 16 },
  searchSectionLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#8A5A64",
    marginBottom: 8,
  },
  freqCount: { color: "#E8425A", fontWeight: 800 },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  filterChip: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "#8F626C",
    background: "#fff",
    border: "1.5px solid #F5CDD6",
    borderRadius: 20,
    padding: "5px 12px",
    cursor: "pointer",
  },
  filterChipOn: { color: "#fff", background: "#E8425A", borderColor: "#E8425A" },
  searchStat: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: 800,
    color: "#C0304A",
  },
  searchCount: {
    marginTop: 10,
    fontSize: 12.5,
    color: "#B0707E",
    fontWeight: 600,
  },
  searchEmpty: {
    marginTop: 20,
    textAlign: "center",
    color: "#C99AA4",
    fontSize: 14,
    padding: "30px 0",
  },
  resultList: {
    listStyle: "none",
    margin: "10px 0 0",
    padding: 0,
  },
  resultRow: { borderBottom: "1px solid #FBEEF1", padding: "10px 2px" },
  resultBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    border: "none",
    background: "none",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
  },
  resultDate: {
    fontSize: 12,
    color: "#A87E88",
    fontWeight: 600,
    width: 56,
    flexShrink: 0,
  },
  resultName: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    fontWeight: 600,
    color: "#43222A",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  resultTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
    paddingLeft: 66,
  },

  // 태그 요약 줄
  tagBar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  tagSummary: { display: "flex", flexWrap: "wrap", gap: 6 },
  tagPill: {
    fontSize: 12,
    fontWeight: 700,
    color: "#B84A62",
    background: "#FCE9EE",
    padding: "3px 10px",
    borderRadius: 20,
  },
  tagToggle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#C77E8B",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "3px 4px",
    marginLeft: "auto",
  },

  // 칩 편집 패널
  chipPanel: {
    marginTop: 10,
    padding: "12px 13px",
    borderRadius: 13,
    background: "#FFF7F9",
    border: "1px solid #FBE7EC",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  chipGroup: { display: "flex", flexDirection: "column", gap: 7 },
  chipLabel: { fontSize: 12, fontWeight: 800, color: "#8A5A64" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "#8F626C",
    background: "#fff",
    border: "1.5px solid #F5CDD6",
    borderRadius: 20,
    padding: "5px 12px",
    cursor: "pointer",
  },
  chipOn: {
    color: "#fff",
    background: "#E8425A",
    borderColor: "#E8425A",
  },
  customInput: {
    fontSize: 12.5,
    width: 100,
    border: "1.5px solid #E8425A",
    borderRadius: 20,
    padding: "5px 12px",
    outline: "none",
  },

  inputBar: { display: "flex", gap: 9, marginTop: 16 },
  input: {
    flex: 1,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1.5px solid #F5CDD6",
    fontSize: 14.5,
    outline: "none",
    background: "#fff",
  },
  addBtn: {
    padding: "0 22px",
    borderRadius: 14,
    border: "none",
    background: "#E8425A",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  kbdHint: { textAlign: "center", fontSize: 12, color: "#C99AA4", marginTop: 12 },

  // 오른쪽
  rightCol: {
    background: "#fff",
    borderRadius: 22,
    padding: "24px 24px 26px",
    boxShadow: "0 14px 38px rgba(232,66,90,0.08)",
    border: "1px solid #FBDCE3",
  },
  panelTitle: { fontSize: 18, fontWeight: 800, marginBottom: 14 },
  legend: { display: "flex", gap: 16, marginBottom: 20 },
  legendItem: {
    fontSize: 12.5,
    color: "#8A5A64",
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  },
  dot: { width: 10, height: 10, borderRadius: 5, display: "inline-block" },

  chart: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 220,
    gap: 10,
  },
  barCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
  },
  barTrack: {
    flex: 1,
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  barStack: {
    width: "68%",
    display: "flex",
    flexDirection: "column-reverse",
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 4,
  },
  barEmpty: { height: 4, background: "#F7E3E8" },
  barLabel: { fontSize: 13, color: "#A87E88", marginTop: 9, fontWeight: 600 },
  barLabelCur: { color: "#E8425A", fontWeight: 800 },

  summary: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #FBEEF1",
  },
  summaryEmpty: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #FBEEF1",
    textAlign: "center",
    color: "#C99AA4",
    fontSize: 13.5,
  },
  summaryHead: { fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#8A5A64" },
  summaryBars: { display: "flex", flexDirection: "column", gap: 12 },
  summaryLine: { display: "flex", alignItems: "center", gap: 12 },
  summaryLabel: { width: 72, fontSize: 12.5, color: "#8A5A64", fontWeight: 600, whiteSpace: "nowrap" },
  summaryTrack: {
    flex: 1,
    height: 13,
    background: "#FBEBEF",
    borderRadius: 6,
    overflow: "hidden",
  },
  summaryPct: {
    width: 40,
    textAlign: "right",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#6A3A44",
  },
};
