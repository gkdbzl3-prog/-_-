import React, { useState, useRef, useEffect } from "react";


const CATS = {
  fast: { label: "패스트푸드", color: "#E8425A", soft: "#FCE2E7" },
  normal: { label: "일반식", color: "#F0637A", soft: "#FDE7EC" },
  healthy: { label: "건강식", color: "#F79BA8", soft: "#FDEEF1" },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
      note: data.note,
    };
  } catch (error) {
    console.error("칼로리 추정 오류:", error);

    return null;
  }
}

export default function FoodLogWeb() {
  const [today] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem("foodLogs");

    if (!saved) return {};

    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  });

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [anim, setAnim] = useState("");

  const curDate = addDays(today, offset);
  const curKey = dateKey(curDate);
  const items = logs[curKey] || [];

  function go(delta) {
    setAnim(delta > 0 ? "left" : "right");
    setOffset((o) => o + delta);
    setTimeout(() => setAnim(""), 240);
  }

  useEffect(() => {
    localStorage.setItem("foodLogs", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    function onKey(e) {
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function addFood() {
    const name = input.trim();
    if (!name || busy) return;
    setBusy(true);
    const [cat, calorieInfo] = await Promise.all([
      classifyFood(name),
      estimateCalories(name),
    ]);
    console.log("cat:", cat);
    console.log("calorieInfo:", calorieInfo);
    setLogs((prev) => {
      // [저장]
      const day = prev[curKey] ? [...prev[curKey]] : [];
      day.push({
         id: Date.now(),
        name,
        cat,
      calorieInfo,
     });
      return { ...prev, [curKey]: day };
    });
    setInput("");
    setBusy(false);
  }

  function removeFood(id) {
    setLogs((prev) => ({
      ...prev,
      [curKey]: (prev[curKey] || []).filter((f) => f.id !== id),
    }));
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

        {/* 2단 레이아웃 */}
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
                    <li key={f.id} style={S.foodRow}>
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
                        <button
                          style={S.del}
                          onClick={() => removeFood(f.id)}
                          aria-label="삭제"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "#E8425A",
  },
  logoMark: { color: "#F0637A", marginRight: 6 },
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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #FBEEF1",
  },
  foodName: { fontSize: 15.5, fontWeight: 600 },
  rowRight: { display: "flex", alignItems: "center", gap: 9 },
  badge: { fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 },
  del: {
    border: "none",
    background: "none",
    color: "#E0B4BD",
    fontSize: 20,
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 2px",
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
  summaryLabel: { width: 66, fontSize: 12.5, color: "#8A5A64", fontWeight: 600 },
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
