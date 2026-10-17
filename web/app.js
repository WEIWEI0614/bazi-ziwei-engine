/* UI layer. All computation comes from engine.js. */
(function () {
  "use strict";
  const BUILD = "2026-10-18a";
  /* 自愈：如果页面骨架是旧版缓存（没有新容器），强制带参数重载一次，
     避免「旧 HTML + 新 JS」这种半新半旧组合把整页打空。 */
  if (!document.getElementById("bzTable")) {
    if (!sessionStorage.getItem("ml_reload")) {
      sessionStorage.setItem("ml_reload", "1");
      location.replace(location.pathname + "?v=" + Date.now());
      return;
    }
    document.body.innerHTML =
      '<div style="padding:40px;font:14px/1.8 system-ui;color:#e9e6df">' +
      '<h3 style="color:#e8a33d">页面缓存版本不一致</h3>' +
      '请按 <b>⌘⇧R</b>（Windows 为 Ctrl+F5）强制刷新。</div>';
    return;
  }
  const ML = window.ML;
  let LANG = "zh";
  let R = null;
  let SEL = 0;
  let FOCUS = 2026;

  const S = {
    tabs: { zh: ["命盘", "评分", "大运流年", "流月", "经历对照", "方法"], en: ["Chart", "Scores", "Cycles", "Months", "Back-test", "Method"] },
    bazi: { zh: "四柱八字", en: "Four Pillars" },
    dayun: { zh: "大运", en: "Ten-year cycles" },
    liunian: { zh: "流年", en: "Annual" },
    zw: { zh: "紫微斗数命盘", en: "Zi Wei Dou Shu Board" },
    overall: { zh: "综合格局", en: "Overall Structure" },
    radar: { zh: "六维", en: "Six Dimensions" },
    dims: { zh: "评分拆解", en: "Score Breakdown" },
    areas: { zh: "六领域", en: "Six Life Areas" },
    read: { zh: "命局解读", en: "Interpretation" },
    school: { zh: "流派视角", en: "School Views" },
    ss: { zh: "神煞 · 刑冲合害", en: "Stars & Interactions" },
    luck: { zh: "大运", en: "Ten-Year Cycles" },
    timeline: { zh: "流年走势", en: "Annual Trend" },
    month: { zh: "流月", en: "Monthly" },
    event: { zh: "经历对照", en: "Back-test Against Your Life" },
    method: { zh: "方法与校验", en: "Method & Validation" },
    rows: { zh: ["主星", "天干", "地支", "藏干", "副星", "星运", "空亡", "纳音", "神煞"],
            en: ["God", "Stem", "Branch", "Hidden", "Sub-gods", "Stage", "Void", "Nayin", "Stars"] },
    cols: { zh: ["", "年柱", "月柱", "日柱", "时柱"], en: ["", "Year", "Month", "Day", "Hour"] },
    kinds: { zh: ["事业", "财务", "感情", "健康", "学业", "迁移", "家庭", "失去"], en: ["Career", "Money", "Love", "Health", "Study", "Move", "Family", "Loss"] },
    kindKeys: ["career", "wealth", "love", "health", "study", "move", "family", "loss"],
    evHint: {
      zh: "填写 3 条以上真实经历（升学、换工作、迁移、婚恋、疾病、破财……），引擎会逐年比对它原本给出的评分，报告吻合率与相关系数，并重新拟合权重。这是唯一能验证这套模型对<b>你</b>是否有效的方法。",
      en: "Enter three or more real events (school, job change, relocation, marriage, illness, loss). The engine compares its own year scores against them, reports hit-rate and correlation, then refits the weights."
    },
    addEv: { zh: "+ 添加事件", en: "+ Add event" },
    runEv: { zh: "开始对照 · Calibrate", en: "Run back-test" },
    hit: { zh: "吻合率", en: "Hit rate" },
    corr: { zh: "相关系数", en: "Correlation" },
    corr2: { zh: "校准后相关系数", en: "After calibration" },
    verdict: { zh: "结论", en: "Verdict" }
  };
  const t = (k) => (S[k] && S[k][LANG]) || k;
  const $ = (id) => document.getElementById(id);
  const bandCls = (s) => s >= 65 ? "p-hi" : s >= 45 ? "p-mid" : "p-low";
  const bandColor = (s) => s >= 70 ? "#5dcaa5" : s >= 58 ? "#8fc98a" : s >= 45 ? "#e8a33d" : s >= 32 ? "#e2855f" : "#e2635f";
  const WX = { 木: "wx-木", 火: "wx-火", 土: "wx-土", 金: "wx-金", 水: "wx-水" };
  const NAT = { 吉: "ji", 凶: "xiong", 中: "zhong" };

  /* ---------- chrome ---------- */
  function paintChrome() {
    const tabs = $("tabs"); tabs.innerHTML = "";
    const secs = ["chart", "score", "year", "month", "event", "method"];
    S.tabs[LANG].forEach((label, i) => {
      const d = document.createElement("div");
      d.className = "tab" + (i === 0 ? " on" : "");
      d.textContent = label;
      d.onclick = () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
        document.querySelectorAll(".view").forEach((x) => x.classList.remove("on"));
        d.classList.add("on"); $("v-" + secs[i]).classList.add("on");
        if (secs[i] === "score") drawRadar();
      };
      tabs.appendChild(d);
    });
    const set = (id, txt) => { const e = $(id); if (e) e.textContent = txt; };
    set("h-bazi", t("bazi")); set("h-dayun", t("dayun")); set("h-liunian", t("liunian"));
    set("h-zw", t("zw")); set("h-overall", t("overall")); set("h-radar", t("radar"));
    set("h-dims", t("dims")); set("h-areas", t("areas")); set("h-read", t("read"));
    set("h-school", t("school")); set("h-ss", t("ss")); set("h-luck", t("luck"));
    set("h-timeline", t("timeline")); set("h-month", t("month"));
    set("h-event", t("event")); set("h-method", t("method"));
    $("evHint").innerHTML = t("evHint");
    set("addEv", t("addEv")); set("runEv", t("runEv"));
    $("evHead").innerHTML = `<div>${LANG === "zh" ? "年份" : "Year"}</div><div>${LANG === "zh" ? "类型" : "Type"}</div><div>${LANG === "zh" ? "说明" : "Note"}</div><div style="text-align:center">${LANG === "zh" ? "影响 −3…+3" : "Impact"}</div><div></div>`;
    $("langBtn").textContent = LANG === "zh" ? "EN" : "中";
    set("go", LANG === "zh" ? "排盘 · Cast" : "Cast chart");
    set("l-ts", LANG === "zh" ? "真太阳时" : "True solar");
    set("l-zs", LANG === "zh" ? "子初换日" : "Day at 23:00");
    set("l-fx", LANG === "zh" ? "飞星派四化" : "Feixing sihua");
    set("l-lp", LANG === "zh" ? "闰月分半" : "Split leap month");
    set("l-fy", LANG === "zh" ? "流年" : "Year");
    $("foot").innerHTML = (LANG === "zh"
      ? "命理引擎 · 零依赖 · 天文历法自算 · 八字与紫微斗数双系统 · 仅供研究与传统文化学习，不构成任何决策建议。"
      : "Mingli Engine · zero dependencies · astronomical calendar · BaZi + Zi Wei Dou Shu · for research and study only, not advice.")
      + ` <span style="opacity:.5">· build ${BUILD}</span>`;
  }

  /* ---------- bazi table ---------- */
  function shenshaByPillar() {
    const map = { 年: [], 月: [], 日: [], 时: [] };
    Object.keys(R.bazi.shensha).forEach((name) => {
      const v = R.bazi.shensha[name];
      v.positions.forEach((p) => { if (map[p]) map[p].push([name, v.nature]); });
    });
    return map;
  }

  function renderBaziTable() {
    const b = R.bazi, cols = ["年", "月", "日", "时"];
    const ss = shenshaByPillar();
    const hd = S.cols[LANG].map((c) => `<th>${c}</th>`).join("");
    let html = `<thead><tr>${hd}</tr></thead><tbody>`;
    const row = (label, fn, cls) => {
      html += `<tr${cls ? ' class="' + cls + '"' : ""}><th>${label}</th>` +
        b.pillars.map((p, i) => `<td class="${p.position === "day" ? "daycol" : ""}">${fn(p, i)}</td>`).join("") +
        "</tr>";
    };
    row(S.rows[LANG][0], (p) => `<span class="tag">${p.position === "day" ? "日主" : p.shishenGan}</span>`);
    row(S.rows[LANG][1], (p) => `<span class="gz ${WX[p.ganWx]}">${p.gan}</span>`, "gzrow");
    row(S.rows[LANG][2], (p) => `<span class="gz ${WX[p.zhiWx]}">${p.zhi}</span>`, "gzrow");
    row(S.rows[LANG][3], (p) => p.hidden.join(" "));
    row(S.rows[LANG][4], (p) => p.hidden.map((h) => {
      const ssg = ML.shishen(b.dayMaster, h);
      return `<span class="sub">${h} ${ssg}</span>`;
    }).join(""));
    row(S.rows[LANG][5], (p) => p.stage);
    row(S.rows[LANG][6], (p) => p.kong.join(""));
    row(S.rows[LANG][7], (p) => p.nayin);
    row(S.rows[LANG][8], (p, i) => {
      const list = ss[cols[i]] || [];
      return list.length ? list.map(([n, na]) => `<span class="tag ${NAT[na]}">${n}</span>`).join("") : "—";
    });
    html += "</tbody>";
    $("bzTable").innerHTML = html;
    $("liunianNote").textContent = LANG === "zh"
      ? `起运 ${R.cycles[0].startAge} 岁 · ${R.cycles[0].startYear} 年交运｜${R.bazi.strengthLabel} · ${R.bazi.dayMaster}${R.bazi.dayMasterWx} · ${R.bazi.structure.name}｜点击任一大运查看其十年流年`
      : `First cycle at age ${R.cycles[0].startAge} (${R.cycles[0].startYear}) · ${R.bazi.strengthLabel} · ${R.bazi.dayMaster} ${R.bazi.dayMasterWx} · ${R.bazi.structure.name} · click a cycle for its ten years`;
  }

  /* ---------- dayun / liunian ---------- */
  function renderDayun() {
    const strip = $("dayunStrip");
    strip.innerHTML = R.cycles.map((c, i) =>
      `<div class="lk${SEL === i ? " on" : ""}${c.active ? " cur" : ""}" data-i="${i}">
        <div class="gz">${c.label}</div>
        <div class="ss">${c.shishenGan}</div>
        <div class="yr">${c.startAge}–${c.endAge} 岁</div>
        <div class="yr">${c.startYear}</div>
      </div>`).join("");
    strip.querySelectorAll(".lk").forEach((el) => {
      el.onclick = () => { SEL = +el.dataset.i; renderDayun(); renderLiunian(); };
    });
  }

  function renderLiunian() {
    const cyc = R.cycles[SEL] || R.cycles[0];
    const strip = $("liunianStrip");
    const rows = [];
    for (let y = cyc.startYear; y < cyc.startYear + 10; y++) rows.push(ML.yearPeriod(R.bazi, y, cyc));
    strip.innerHTML = rows.map((d) =>
      `<div class="lk" title="${d.band}">
        <div class="gz" style="color:${bandColor(d.score)}">${d.label}</div>
        <div class="yr">${d.name} · ${d.age}</div>
        <div class="yr" style="color:${bandColor(d.score)}">${d.score.toFixed(0)} ${d.band}</div>
      </div>`).join("");
  }

  /* ---------- ziwei board ---------- */
  const LAYOUT = [
    [1, 1, "巳"], [1, 2, "午"], [1, 3, "未"], [1, 4, "申"],
    [2, 1, "辰"], [2, 4, "酉"], [3, 1, "卯"], [3, 4, "戌"],
    [4, 1, "寅"], [4, 2, "丑"], [4, 3, "子"], [4, 4, "亥"]
  ];
  const SANFANG = new Set(["命宫", "财帛", "官禄", "迁移"]);

  function renderBoard() {
    const z = R.ziwei, b = R.bazi;
    const board = $("board");
    board.innerHTML = "";
    LAYOUT.forEach(([r, c, br]) => {
      const p = z.palaces.find((x) => x.branch === br);
      const cell = document.createElement("div");
      cell.className = "cell" + (SANFANG.has(p.name) ? " san" : "");
      cell.title = `${p.name} ${p.gan}${p.branch}｜大限 ${p.decade[0]}-${p.decade[1]}｜小限 ${(p.ages || []).slice(0, 8).join(" ")}…`;
      cell.onclick = () => showPalace(p);
      cell.style.gridRow = r; cell.style.gridColumn = c;
      const huaTag = (s) => s.hua ? `<span class="hua hua${s.hua}">${s.hua}</span>` : "";
      const maj = p.stars.filter((s) => s.kind === "主星")
        .map((s) => `<i>${s.name}${huaTag(s)}${s.brightness ? `<span class="b">${s.brightness}</span>` : ""}</i>`).join("");
      const mn = p.stars.filter((s) => s.kind === "辅星" || s.kind === "煞星")
        .map((s) => `<i class="${s.kind === "煞星" ? "bad" : ""}">${s.name}${huaTag(s)}</i>`).join("");
      const ad = p.stars.filter((s) => s.kind === "杂曜").map((s) => `<span>${s.name}</span>`).join("");
      const self = (p.selfHua || []).map(([n, h]) => `${n}自化${h}`).join(" ");
      cell.innerHTML = `
        <div class="hd"><b>${p.name}</b>${p.isBody ? '<span style="color:var(--purple)">身</span>' : ""}
          <span class="gzc">${p.gan}${p.branch} · ${p.decade[0]}–${p.decade[1]}</span></div>
        <div class="maj">${maj}</div>
        <div class="min">${mn}</div>
        <div class="adj">${ad}</div>
        <div class="gods"><b>${p.changsheng}</b><b>${p.boshi}</b><b>${p.suiqian}</b><b>${p.jiangqian}</b></div>
        ${self ? `<div style="font-size:9.5px;color:#7b6a4a;margin-top:1px">${self}</div>` : ""}
        <div class="bh">${p.branch}</div>`;
      board.appendChild(cell);
    });

    const c = document.createElement("div");
    c.className = "center";
    const zs = R.zsummary, ld = b.lunar;
    const sihua = Object.keys(z.sihua).map((k) => `${k}化${z.sihua[k]}`).join("　");
    c.innerHTML = `<h3>命盘</h3>
      <div class="r"><span>出生</span><b>${b.birth.y}-${String(b.birth.m).padStart(2, "0")}-${String(b.birth.d).padStart(2, "0")} ${String(b.birth.h).padStart(2, "0")}:${String(b.birth.mi).padStart(2, "0")}</b></div>
      <div class="r"><span>农历</span><b>${ld.year} · ${ld.isLeap ? "闰" : ""}${ld.month}月${ld.day}日 ${z.hourBranch}时</b></div>
      <div class="r"><span>四柱</span><b class="gz">${b.pillars.map((p) => p.gan + p.zhi).join(" ")}</b></div>
      <div class="r"><span>五行局 / 紫微</span><b>${z.ju} · ${z.ziweiBranch}</b></div>
      <div class="r"><span>命宫 / 身宫</span><b>${z.mingBranch} / ${z.shenBranch}</b></div>
      <div class="r"><span>命主 / 身主</span><b>${z.mingZhu} / ${z.shenZhu}</b></div>
      <div class="r"><span>斗君</span><b>${z.douJun}</b></div>
      <div class="r"><span>生年四化</span><b style="font-size:11px">${sihua}</b></div>
      <div class="r"><span>格局</span><b style="font-size:11px">${zs.patterns.map((p) => p.name).join("、") || "—"}</b></div>
      <div class="r"><span>流年命宫</span><b>${R.ziweiYear.ganzhi} · ${R.ziweiYear.palace}</b></div>`;
    board.appendChild(c);
    $("zwLegend").innerHTML = `<span>主星后上标为庙旺得利平陷</span><span style="color:var(--teal)">辅星</span>
      <span style="color:var(--red)">煞星</span><span>灰字为杂曜</span>
      <span>四化：<span class="hua hua禄">禄</span><span class="hua hua权">权</span><span class="hua hua科">科</span><span class="hua hua忌">忌</span></span>
      <span>底部「长生 · 博士 · 岁前 · 将前」；右下为大限岁数</span>`;
  }

  function showPalace(p) {
    const z = R.ziwei;
    const tbl = $("f-feixing").checked ? window.ML_DATA.SIHUA_FEIXING : window.ML_DATA.SIHUA_SANHE;
    const hua = {};
    tbl[p.gan].forEach((st, i) => { hua[st] = ["禄", "权", "科", "忌"][i]; });
    const fly = Object.keys(hua).map((st) => {
      const target = z.palaces.find((q) => q.stars.some((s) => s.name === st));
      return target ? `<span class="hua hua${hua[st]}">${hua[st]}</span> ${st} → ${target.name}` : "";
    }).filter(Boolean).join("　");
    const tri = [-4, 4, 6].map((o) => z.palaces.find((q) => q.index === (p.index + o) % 12));
    const lis = (arr, cls) => arr.map((s) => `<span class="${cls}">${s.name}${s.hua ? "化" + s.hua : ""}${s.brightness ? "[" + s.brightness + "]" : ""}</span>`).join("　");
    $("palaceDetail").innerHTML = `
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px">
        <b style="font-family:var(--serif);font-size:17px;color:var(--amber2)">${p.name}</b>
        <span style="font-family:var(--serif);color:var(--tx2)">${p.gan}${p.branch}</span>
        <span class="note">大限 ${p.decade[0]}–${p.decade[1]} 岁　小限 ${(p.ages || []).slice(0, 6).join(" / ")}…</span>
        <span class="note">长生 ${p.changsheng}　博士 ${p.boshi}　岁前 ${p.suiqian}　将前 ${p.jiangqian}</span>
      </div>
      <div style="margin-bottom:4px"><span class="note">主星　</span>${lis(p.stars.filter((s) => s.kind === "主星"), "maj") || "（空宫，借对宫）"}</div>
      <div style="margin-bottom:4px"><span class="note">辅煞　</span>${lis(p.stars.filter((s) => s.kind !== "主星" && s.kind !== "杂曜"), "min") || "—"}</div>
      <div style="margin-bottom:4px"><span class="note">杂曜　</span><span class="note">${p.stars.filter((s) => s.kind === "杂曜").map((s) => s.name).join("　") || "—"}</span></div>
      <div style="margin-bottom:4px"><span class="note">宫干飞化　</span>${fly}</div>
      <div><span class="note">三方四正　</span>${tri.map((q) => `${q.name}(${q.gan}${q.branch})`).join("　")}</div>`;
  }

  /* ---------- score ---------- */
  function renderScore() {
    const s = R.scores, zs = R.zsummary, ue = ML.usefulElements(R.bazi);
    $("overall").textContent = s.overall.toFixed(1);
    $("tier").textContent = s.tier;
    $("tierNote").innerHTML = `日主 <b style="color:var(--amber2)">${R.bazi.dayMaster}${R.bazi.dayMasterWx}</b>，${R.bazi.strengthLabel}（${R.bazi.strength.toFixed(0)}%）；格局 <b>${R.bazi.structure.name}</b>；命宫 <b>${zs.mingStars.join(" / ") || "空宫"}</b>。<br>
      喜用 <b style="color:var(--teal)">${ue.favor.join(" ")}</b>，忌 <b style="color:var(--red)">${ue.avoid.join(" ")}</b>；调候 ${R.bazi.tiaohou.sequence || "—"}。<br>
      <span style="color:var(--tx3)">60 分以上为可用之局，75 分以上属同类优等。它读数结构张力，不是命运的绝对值。</span>`;

    const zh = { structure: "结构格局", flow: "五行流通", climate: "调候得宜", ming: "紫微命宫", sanfang: "三方四正", yongshen: "用神得力" };
    $("dims").innerHTML = Object.keys(s.dimensions).map((k) =>
      `<div class="dimrow"><span class="nm">${zh[k]}</span>
       <span class="bar"><i style="width:${s.dimensions[k]}%;background:${bandColor(s.dimensions[k])}"></i></span>
       <span class="vl">${s.dimensions[k].toFixed(0)}</span></div>`).join("") +
      `<div class="note" style="margin-top:6px">权重：${Object.keys(s.weights).map((k) => `${zh[k]} ${(s.weights[k] * 100).toFixed(0)}%`).join(" · ")}</div>`;

    const az = { career: "事业", wealth: "财富", love: "感情", health: "健康", study: "学业", social: "人脉" };
    $("areas").innerHTML = Object.keys(s.areas).map((k) =>
      `<div class="dimrow"><span class="nm">${az[k]}</span>
       <span class="bar"><i style="width:${s.areas[k]}%;background:${bandColor(s.areas[k])}"></i></span>
       <span class="vl">${s.areas[k].toFixed(0)}</span></div>`).join("");

    const b = R.bazi;
    $("bzread").innerHTML = `
      <dt>日主</dt><dd>${b.dayMaster}（${b.dayMasterWx}）· ${b.strengthLabel} ${b.strength.toFixed(1)}%</dd>
      <dt>格局</dt><dd>${b.structure.name}</dd><dt></dt><dd class="note">${b.structure.basis}</dd>
      <dt>调候</dt><dd>${b.tiaohou.sequence || "—"}　已见 ${b.tiaohou.satisfied.join("") || "无"}　缺 ${b.tiaohou.missing.join("") || "无"}</dd>
      <dt>喜用</dt><dd>${ue.favor.join(" ")}</dd><dt>忌神</dt><dd>${ue.avoid.join(" ")}</dd>
      <dt>五行</dt><dd>${Object.keys(b.elementScores).map((k) => `<span class="${WX[k]}">${k} ${b.elementScores[k].toFixed(1)}%</span>`).join("　")}</dd>`;
    const z = R.ziwei, dec = R.ziweiDecades.find((d) => d.active);
    $("zwread").innerHTML = `
      <dt>命宫</dt><dd>${z.mingBranch} · ${R.zsummary.mingStars.join(" / ") || "空宫"}</dd>
      <dt>身宫</dt><dd>${z.shenBranch} · ${R.zsummary.bodyPalace}</dd>
      <dt>命主</dt><dd>${z.mingZhu}　身主 ${z.shenZhu}</dd>
      <dt>五行局</dt><dd>${z.ju}</dd>
      <dt>格局</dt><dd>${R.zsummary.patterns.map((p) => p.name).join("、") || "—"}</dd>
      <dt></dt><dd class="note">${R.zsummary.patterns.map((p) => p.desc).join("；") || ""}</dd>
      <dt>大限</dt><dd>${dec ? `${dec.startAge}–${dec.endAge} 岁 · ${dec.palace} · ${dec.theme}` : "—"}</dd>
      <dt>宫位分</dt><dd>命 ${R.zsummary.mingScore.toFixed(0)}　官 ${R.zsummary.careerScore.toFixed(0)}　财 ${R.zsummary.wealthScore.toFixed(0)}</dd>`;

    $("schoolbox").innerHTML = schoolViews();
    const ss = b.shensha, rel = b.relations;
    const relZh = { 合: "六合", 冲: "六冲", 刑: "刑", 害: "害", 破: "破", 干合: "天干合", 干冲: "天干冲", 三合: "三合", 三会: "三会", 半合: "半合" };
    const groups = { 吉: [], 中: [], 凶: [] };
    Object.keys(ss).forEach((k) => groups[ss[k].nature].push(k));
    $("ssbox").innerHTML = ["吉", "中", "凶"].map((g) =>
      `<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--tx3);letter-spacing:.1em">${g}</span><br>` +
      (groups[g].length ? groups[g].map((k) =>
        `<span class="tag ${NAT[g]}" title="${ss[k].desc}｜${ss[k].basis}">${k}<span style="opacity:.65"> ${ss[k].positions.join("")}</span></span>`).join("") : "—") +
      `</div>`).join("") +
      `<div style="border-top:1px solid var(--line);padding-top:8px">${Object.keys(rel).length
        ? Object.keys(rel).map((k) => `<span class="tag">${relZh[k] || k}：${rel[k].map((x) => x.pair).join("　")}</span>`).join("")
        : "—"}</div>`;
  }

  function schoolViews() {
    const b = R.bazi, s = R.scores, zs = R.zsummary, z = R.ziwei;
    const el = b.elementScores;
    const dom = Object.keys(el).sort((x, y) => el[y] - el[x])[0];
    const weak = Object.keys(el).sort((x, y) => el[x] - el[y])[0];
    const ZH = { ziping: "子平 · 格局法", tiaohou: "调候 · 穷通宝鉴", xinpai: "新派 · 量化旺衰", ziwei: "紫微 · 三方四正" };
    const rows = [
      ["ziping", `月令${b.month.zhi}，${b.structure.basis}。${b.structure.kind === "特殊格" ? "特殊格局，成败系于一点，不宜以常规喜忌论。" : "属普通格，重在用神是否透出有力。"}日主${b.strengthLabel}，${b.strength >= 52 ? "宜泄宜克，不宜再补。" : b.strength <= 45 ? "宜生宜扶，忌再耗泄。" : "中和可任财官，取用弹性较大。"}`],
      ["tiaohou", `《穷通宝鉴》${b.dayMaster}日生${b.month.zhi}月，调候取${b.tiaohou.sequence || "—"}（${b.tiaohou.primary || "—"}为先）。已见 ${b.tiaohou.satisfied.join("") || "无"}，缺 ${b.tiaohou.missing.join("") || "无"}。${b.tiaohou.missing.length ? "调候有缺，主环境支持不足，需后天补（方位、行业、择时）。" : "调候齐备，先天气候得宜，起手条件不差。"}`],
      ["xinpai", `按干支加权（月令 24 %）叠加旺相休囚死系数，${dom}最旺（${el[dom].toFixed(1)}%），${weak}最弱（${el[weak].toFixed(1)}%）。同党合计 ${b.strength.toFixed(1)}%，判为${b.strengthLabel}。量化法可比可追踪，但不认格局贵贱，故只作六维中的一维。`],
      ["ziwei", `命宫${z.mingBranch}，${zs.mingStars.join("、") || "空宫"}；三方四正 ${s.dimensions.sanfang}。${zs.patterns.length ? "成格：" + zs.patterns.map((p) => p.name + "（" + p.desc + "）").join("；") : "未成典型格局，按宫位单论"}。财帛 ${zs.wealthScore}、官禄 ${zs.careerScore}——${zs.careerScore > zs.wealthScore ? "事业强于财帛，宜以职位与专业换资源。" : "财帛强于官禄，宜以经营与配置取胜。"}`]
    ];
    return rows.map(([k, txt]) =>
      `<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--amber);letter-spacing:.08em;margin-bottom:3px">${ZH[k]}</div>
       <div class="note" style="color:var(--tx2)">${txt}</div></div>`).join("");
  }

  function drawRadar() {
    if (!R) return;
    const d = R.scores.dimensions, keys = Object.keys(d);
    const zh = { structure: "结构", flow: "流通", climate: "调候", ming: "命宫", sanfang: "三方", yongshen: "用神" };
    const cx = 160, cy = 148, rad = 96, n = keys.length;
    let out = "";
    for (let ring = 1; ring <= 4; ring++) {
      const rr = rad * ring / 4;
      out += `<polygon points="${keys.map((_, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      }).join(" ")}" fill="none" stroke="#282c36"/>`;
    }
    keys.forEach((_, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      out += `<line x1="${cx}" y1="${cy}" x2="${cx + rad * Math.cos(a)}" y2="${cy + rad * Math.sin(a)}" stroke="#282c36"/>`;
    });
    out += `<polygon points="${keys.map((k, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      const rr = rad * Math.max(0.04, d[k] / 100);
      return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    }).join(" ")}" fill="rgba(232,163,61,.18)" stroke="#e8a33d" stroke-width="1.8"/>`;
    keys.forEach((k, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      const rr = rad * Math.max(0.04, d[k] / 100);
      out += `<circle cx="${cx + rr * Math.cos(a)}" cy="${cy + rr * Math.sin(a)}" r="2.8" fill="#f3c26b"/>`;
      const lx = cx + (rad + 26) * Math.cos(a), ly = cy + (rad + 24) * Math.sin(a);
      out += `<text x="${lx}" y="${ly}" fill="#a4a3a0" font-size="11" text-anchor="middle">${zh[k]}</text>`;
      out += `<text x="${lx}" y="${ly + 12}" fill="#e9e6df" font-size="10" text-anchor="middle">${d[k].toFixed(0)}</text>`;
    });
    $("radar").innerHTML = out;
  }

  /* ---------- years / months ---------- */
  function renderYears() {
    $("cycTable").innerHTML = `<thead><tr><th>大运</th><th>年龄</th><th>年份</th><th>十神</th><th>主导宫位</th><th></th></tr></thead><tbody>` +
      R.cycles.map((c) => {
        const dec = R.ziweiDecades.find((d) => d.startYear <= c.startYear + 5 && c.startYear + 5 <= d.endYear);
        return `<tr${c.active ? ' style="background:#221f18"' : ""}>
          <td><b style="font-family:var(--serif);font-size:15px;color:${c.active ? "var(--amber2)" : "var(--tx)"}">${c.label}</b></td>
          <td class="num">${c.startAge}–${c.endAge}</td>
          <td class="num">${c.startYear}–${c.endYear}</td>
          <td>${c.shishenGan} / ${c.shishenZhi}</td>
          <td class="note">${dec ? dec.palace + " · " + dec.theme : "—"}</td>
          <td>${c.active ? '<span class="pill p-mid">当前</span>' : ""}</td></tr>`;
      }).join("") + "</tbody>";

    const svg = $("yearChart"), W = 900, H = 210, pad = 34;
    const data = R.timeline, n = data.length;
    const x = (i) => pad + i * (W - pad * 2) / (n - 1);
    const y = (v) => H - pad - (v / 100) * (H - pad * 2);
    let g = "";
    [25, 50, 75].forEach((v) => {
      g += `<line x1="${pad}" y1="${y(v)}" x2="${W - pad}" y2="${y(v)}" stroke="#22262e" stroke-dasharray="${v === 50 ? "0" : "3 4"}"/>`;
      g += `<text x="${pad - 6}" y="${y(v) + 3}" fill="#55554f" font-size="10" text-anchor="end">${v}</text>`;
    });
    const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.score)}`).join(" ");
    g += `<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8a33d" stop-opacity=".32"/><stop offset="1" stop-color="#e8a33d" stop-opacity="0"/></linearGradient></defs>`;
    g += `<path d="${line} L${x(n - 1)},${H - pad} L${x(0)},${H - pad} Z" fill="url(#g1)"/>`;
    g += `<path d="${line}" fill="none" stroke="#e8a33d" stroke-width="1.8"/>`;
    data.forEach((d, i) => {
      g += `<circle cx="${x(i)}" cy="${y(d.score)}" r="3" fill="${bandColor(d.score)}"/>`;
      g += `<text x="${x(i)}" y="${H - pad + 14}" fill="#6f6f6c" font-size="10" text-anchor="middle">${d.name.slice(2)}</text>`;
      g += `<text x="${x(i)}" y="${y(d.score) - 8}" fill="#8d8c88" font-size="9" text-anchor="middle">${d.score.toFixed(0)}</text>`;
    });
    svg.innerHTML = g;

    $("yearTable").innerHTML = `<thead><tr><th>年份</th><th>干支</th><th>大运</th><th class="num">评分</th><th>评级</th><th>主题</th><th>注意事项</th></tr></thead><tbody>` +
      data.map((d) => `<tr>
        <td class="num">${d.name}<span style="color:var(--tx3)"> · ${d.age}</span></td>
        <td><b style="font-family:var(--serif)">${d.label}</b></td>
        <td>${d.luckCycle || "—"}</td>
        <td class="num" style="color:${bandColor(d.score)}">${d.score.toFixed(1)}</td>
        <td><span class="pill ${bandCls(d.score)}">${d.band}</span></td>
        <td class="note">${d.themes.slice(0, 3).join(" · ")}</td>
        <td class="note">${d.cautions.slice(0, 2).join("；") || "—"}</td></tr>`).join("") + "</tbody>";
  }

  function renderMonths() {
    const d = R.months, W = 900, H = 190, pad = 30;
    const bw = (W - pad * 2) / d.length;
    let g = "";
    [25, 50, 75].forEach((v) => {
      const y = H - pad - (v / 100) * (H - pad * 2);
      g += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#22262e" stroke-dasharray="${v === 50 ? "0" : "3 4"}"/>`;
    });
    d.forEach((m, i) => {
      const h = (m.score / 100) * (H - pad * 2);
      const x = pad + i * bw + 3, y = H - pad - h;
      g += `<rect x="${x}" y="${y}" width="${bw - 6}" height="${h}" rx="2.5" fill="${bandColor(m.score)}" opacity=".8"/>`;
      g += `<text x="${x + (bw - 6) / 2}" y="${y - 4}" fill="#8d8c88" font-size="9" text-anchor="middle">${m.score.toFixed(0)}</text>`;
      g += `<text x="${x + (bw - 6) / 2}" y="${H - pad + 13}" fill="#6f6f6c" font-size="9.5" text-anchor="middle">${m.name.slice(5)}</text>`;
      g += `<text x="${x + (bw - 6) / 2}" y="${H - pad + 25}" fill="#4d4d4a" font-size="9" text-anchor="middle">${m.label}</text>`;
    });
    $("monthChart").innerHTML = g;
    $("monthTable").innerHTML = `<thead><tr><th>区间</th><th>干支</th><th class="num">评分</th><th>评级</th><th>主题</th><th>机会</th><th>注意事项</th></tr></thead><tbody>` +
      d.map((m) => `<tr><td class="num">${m.name}</td><td><b style="font-family:var(--serif)">${m.label}</b></td>
        <td class="num" style="color:${bandColor(m.score)}">${m.score.toFixed(1)}</td>
        <td><span class="pill ${bandCls(m.score)}">${m.band}</span></td>
        <td class="note">${m.themes.slice(0, 2).join(" · ")}</td>
        <td class="note">${(m.opportunities || []).slice(0, 1).join("") || "—"}</td>
        <td class="note">${(m.cautions || []).slice(0, 1).join("") || "—"}</td></tr>`).join("") + "</tbody>";
  }

  /* ---------- events ---------- */
  function evRow(ev) {
    const row = document.createElement("div");
    row.className = "ev-row";
    const kinds = S.kindKeys.map((k, i) => `<option value="${k}"${ev && ev.kind === k ? " selected" : ""}>${S.kinds[LANG][i]}</option>`).join("");
    row.innerHTML = `
      <input type="number" class="ev-year" value="${ev ? ev.year : 2020}">
      <select class="ev-kind">${kinds}</select>
      <input type="text" class="ev-note" placeholder="发生了什么" value="${ev ? (ev.note || "") : ""}">
      <input type="range" class="ev-imp" min="-3" max="3" step="1" value="${ev ? ev.impact : 0}">
      <button class="del">×</button>`;
    row.querySelector(".del").onclick = () => row.remove();
    return row;
  }
  function collectEvents() {
    return [...document.querySelectorAll("#evList .ev-row")].map((r) => ({
      year: +r.querySelector(".ev-year").value,
      kind: r.querySelector(".ev-kind").value,
      note: r.querySelector(".ev-note").value,
      impact: +r.querySelector(".ev-imp").value
    })).filter((e) => e.year && e.impact !== 0);
  }
  function renderEventResult() {
    const res = R.events, box = $("evOut");
    if (!res) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <h2 class="sec">对照结果</h2>
      <div class="cards">
        <div class="card"><h4>${t("hit")}</h4><div class="big">${res.hitRate}<small>%</small></div></div>
        <div class="card"><h4>${t("corr")}</h4><div class="big">${res.correlation}</div></div>
        <div class="card"><h4>${t("corr2")}</h4><div class="big" style="color:var(--teal)">${res.calibratedCorrelation}</div></div>
      </div>
      <div class="card" style="margin-top:10px"><h4>${t("verdict")}</h4><div class="note">${res.verdict}</div>
        <div class="note" style="margin-top:5px">校准权重：${Object.keys(res.weights).map((k) => `${k} ${res.weights[k].toFixed(2)}`).join(" · ")}</div></div>
      <div class="card" style="margin-top:10px;overflow-x:auto">
        <table class="dt"><thead><tr><th>年份</th><th>干支</th><th>类型</th><th>自评</th>
        <th class="num">引擎分</th><th class="num">校准分</th><th>吻合</th><th>说明</th></tr></thead><tbody>
        ${res.rows.map((r) => `<tr><td class="num">${r.year}</td><td><b style="font-family:var(--serif)">${r.ganzhi}</b></td>
          <td>${r.kindLabel}</td><td>${r.impact > 0 ? "＋" + r.impact : r.impact}</td>
          <td class="num" style="color:${bandColor(r.predicted)}">${r.predicted.toFixed(1)}</td>
          <td class="num">${r.calibrated.toFixed(1)}</td>
          <td>${r.agree ? '<span class="pill p-hi">吻合</span>' : '<span class="pill p-low">不符</span>'}</td>
          <td class="note">${r.note || (r.cautions[0] || "")}</td></tr>`).join("")}
        </tbody></table></div>`;
  }

  /* ---------- method ---------- */
  function renderMethod() {
    $("methodBox").innerHTML = `
      <dl class="kv">
        <dt>历法</dt><dd>太阳视黄经由截断 VSOP87 计算（含章动、光行差、FK5 修正），节气以牛顿迭代求 15° 整数倍时刻；朔望用 Meeus 第 49 章；农历按「无中气置闰」，以「日」为单位判定（GB/T 33661-2017 口径）。</dd>
        <dt>四柱</dt><dd>年柱立春换年，月柱十二节换月（五虎遁），日柱子初/子正换日可切，时柱五鼠遁。真太阳时 = 经度差 + 均时差。</dd>
        <dt>神煞</dt><dd>35 颗，分吉/中/凶三组，每颗都给出「落宫 + 依据」（如「日干丙帝旺之位」「年支酉查红鸾」），可逐条复核。</dd>
        <dt>紫微</dt><dd>寅首五虎遁定宫干、纳音定五行局、起紫微诀（商数宫前走，借数偶顺奇逆）安十四主星；六吉六煞、38 杂曜、长生/博士/将前/岁前四套十二神、小限、命主身主、斗君、生年四化与宫干自化全部入盘。</dd>
        <dt>校验</dt><dd>历法与四柱：3,000 组随机时刻对 lunar-python，年月日时零误差。紫微：700 张盘对 iztro，命宫/五行局/宫干/十四主星/十三辅煞/四套十二神/小限/大限全部一致（1 例主星差异源于朔日临界）。浏览器 JS 与 Python 逐字段比对，差异仅四舍五入。</dd>
        <dt>局限</dt><dd>①2050 年后 ΔT 只是预测，远期节气可能差数十秒；②朔在午夜前数秒时农历可能差一天（约三十年一遇）；③评分权重是启发式，请用「经历对照」校准；④本工具描述结构倾向，不预测具体事件。</dd>
      </dl>`;
  }

  /* ---------- cast ---------- */
  function cast() {
    let y, mo, d;
    if ($("f-cal").value === "lunar") {
      const raw = ($("f-lunar").value || "").trim().replace(/[年月]/g, "-").replace(/日/g, "");
      const parts = raw.split("-").filter(Boolean);
      if (parts.length < 3) { alert("农历格式：1993-4-25 或 1993-闰4-25"); return; }
      const ly = +parts[0], isLeap = parts[1].includes("闰"), lm = parseInt(parts[1].replace("闰", ""), 10), lday = +parts[2];
      const jd = ML.lunarToJD(ly, lm, lday, isLeap);
      if (jd == null) { alert("该农历日期不存在"); return; }
      const s = ML.fromJD(jd);
      y = s[0]; mo = s[1]; d = s[2];
      $("f-date").value = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    } else {
      const v = ($("f-date").value || "1993-06-14").split("-").map(Number);
      y = v[0]; mo = v[1]; d = v[2];
    }
    const [h, mi] = ($("f-time").value || "12:00").split(":").map(Number);
    const city = $("f-city").value;
    const lon = city === "custom" ? (+$("f-lon").value || 116.4) : +city;
    FOCUS = +$("f-focus").value || new Date().getFullYear();
    R = ML.buildReading({
      name: $("f-name").value || "—", gender: $("f-gender").value,
      y, m: mo, d, h, mi, lon, tz: 8,
      trueSolar: $("f-truesolar").checked,
      ziBoundary: $("f-zistart").checked ? "zi_start" : "zi_mid",
      sihuaSchool: $("f-feixing").checked ? "feixing" : "sanhe",
      leapPolicy: $("f-leapsplit").checked ? "split" : "same",
      focusYear: FOCUS
    });
    SEL = R.cycles.findIndex((c) => c.active);
    if (SEL < 0) SEL = 0;
    renderBaziTable(); renderDayun(); renderLiunian(); renderBoard();
    showPalace(R.ziwei.palaces[0]);
    renderScore(); drawRadar(); renderYears(); renderMonths();
    if (R.events) renderEventResult();
  }

  /* ---------- wire ---------- */
  function activateFromHash() {
    const order = ["chart", "score", "year", "month", "event", "method"];
    const h = (location.hash || "").replace("#", "");
    const i = order.indexOf(h);
    if (i < 0) return;
    document.querySelectorAll(".tab").forEach((x, j) => x.classList.toggle("on", j === i));
    document.querySelectorAll(".view").forEach((x) => x.classList.remove("on"));
    $("v-" + h).classList.add("on");
    if (h === "score") drawRadar();
  }

  document.addEventListener("DOMContentLoaded", () => {
    paintChrome();
    [0, 1, 2].forEach(() => $("evList").appendChild(evRow(null)));
    cast(); renderMethod(); activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
    $("go").onclick = cast;
    $("f-cal").onchange = () => {
      const lunar = $("f-cal").value === "lunar";
      $("wrap-lunar").style.display = lunar ? "" : "none";
      $("wrap-solar").style.display = lunar ? "none" : "";
    };
    $("langBtn").onclick = () => {
      LANG = LANG === "zh" ? "en" : "zh";
      document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
      paintChrome();
      const evs = collectEvents();
      if (R) {
        renderBaziTable(); renderDayun(); renderLiunian(); renderBoard();
        renderScore(); drawRadar(); renderYears(); renderMonths(); renderEventResult();
      }
      renderMethod();
      const list = $("evList"); list.innerHTML = "";
      (evs.length ? evs : [null, null, null]).forEach((e) => list.appendChild(evRow(e)));
    };
    $("f-city").onchange = () => {
      if ($("f-city").value !== "custom") $("f-lon").value = $("f-city").value;
    };
    $("addEv").onclick = () => $("evList").appendChild(evRow(null));
    $("runEv").onclick = () => {
      const evs = collectEvents();
      if (evs.length < 3) { alert("至少填写 3 条经历（影响值不为 0）。"); return; }
      R.events = ML.compareEvents(R.bazi, evs);
      renderEventResult();
    };
  });
})();
