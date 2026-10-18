/* UI layer. All computation comes from engine.js. */
(function () {
  "use strict";
  const BUILD = "2026-10-18c";
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
  const I18 = window.ML_DATA.I18N;
  let LANG = "zh";
  // 支持 ?lang=en 直接进入英文，便于分享与测试
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get("lang") === "en") LANG = "en";
    if (qs.get("lang") === "zh") LANG = "zh";
  } catch (e) { /* ignore */ }
  let R = null;
  let SEL = 0;
  let FOCUS = 2026;

  // tab 与视图 id 的唯一来源：两处都用它，避免加了 tab 忘了改索引
  const SECS = ["chart", "score", "reading", "year", "month", "gua", "syn", "chat", "event", "method"];

  const S = {
    tabs: { zh: ["命盘", "评分", "详解", "大运流年", "流月", "卦象", "合盘", "问答", "经历对照", "方法"],
            en: ["Chart", "Scores", "Reading", "Cycles", "Months", "Hexagram", "Synastry", "Ask", "Back-test", "Method"] },
    chat: { zh: "大模型问答", en: "Ask the model" },
    gua: { zh: "梅花易数起卦", en: "Plum Blossom Divination" },
    syn: { zh: "八字合盘", en: "Synastry" },
    avatar: { zh: "日主形象", en: "Day Master" },
    intensity: { zh: "结构强度", en: "Structural intensity" },
    reading: { zh: "流派详解", en: "Detailed Reading" },
    highlights: { zh: "结构亮点", en: "Strengths" },
    weaknesses: { zh: "结构短板", en: "Deductions" },
    percentile: { zh: "百分位", en: "Percentile" },
    bazi: { zh: "四柱八字", en: "Four Pillars" },
    dayun: { zh: "大运", en: "Ten-year cycles" },
    liunian: { zh: "流年", en: "Annual" },
    zw: { zh: "紫微斗数命盘", en: "Zi Wei Dou Shu Board" },
    overall: { zh: "综合格局", en: "Overall Structure" },
    radar: { zh: "七维", en: "Seven Dimensions" },
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
  const L = (zh, en) => (LANG === "zh" ? zh : en);
  const bandCls = (s) => s >= 68 ? "p-hi" : s >= 46 ? "p-mid" : "p-low";
  const bandColor = (s) => s >= 78 ? "#5dcaa5" : s >= 66 ? "#8fc98a" : s >= 54 ? "#e8a33d" : s >= 44 ? "#e2855f" : "#e2635f";
  const WX = { 木: "wx-木", 火: "wx-火", 土: "wx-土", 金: "wx-金", 水: "wx-水" };
  const NAT = { 吉: "ji", 凶: "xiong", 中: "zhong" };
  const BAND_EN = { 大吉: "excellent", 吉: "good", 小吉: "fair", 平: "neutral",
    小凶: "soft", 偏弱: "weak", 凶: "difficult", 大凶: "difficult" };
  const tr = (x) => !x ? x : (LANG === "zh" ? x :
    (I18.shishen[x] || I18.shensha[x] || I18.structure[x] || I18.star[x] ||
     I18.palaceNameEn[x] || I18.theme[x] || x));
  const bi = (x) => !x ? "" : (typeof x === "string" ? x : (LANG === "zh" ? x.zh : x.en));
  const bandTxt = (b) => LANG === "zh" ? b : (BAND_EN[b] || b);
  const dimName = (k) => LANG === "zh"
    ? { structure: "格局层次", flow: "五行流通", climate: "调候得宜", root: "年月根基",
        ming: "紫微命宫", sanfang: "三方四正", shensha: "神煞吉凶" }[k]
    : { structure: "Structure", flow: "Element flow", climate: "Climate", root: "Foundations",
        ming: "Life palace", sanfang: "Trine", shensha: "Stars" }[k];

  /* ---------- chrome ---------- */
  function paintChrome() {
    const tabs = $("tabs"); tabs.innerHTML = "";
    const secs = SECS;
    S.tabs[LANG].forEach((label, i) => {
      const d = document.createElement("div");
      d.className = "tab" + (i === 0 ? " on" : "");
      d.textContent = label;
      d.onclick = () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
        document.querySelectorAll(".view").forEach((x) => x.classList.remove("on"));
        d.classList.add("on");
        const v = $("v-" + secs[i]);
        if (v) { v.classList.add("on"); annotate(v); }
        if (secs[i] === "score") drawRadar();
        if (secs[i] === "gua" && !$("guaOut").children.length) renderGua();
        if (secs[i] === "syn" && !$("synOut").children.length) { try { renderSyn(); } catch (e) { /* noop */ } }
        history.replaceState(null, "", "#" + secs[i]);
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
    set("h-reading", t("reading"));
    set("h-int", LANG === "zh" ? "结构强度" : "Structural intensity");
    set("h-avatar", LANG === "zh" ? "日主形象" : "Day master");
    set("h-grade", LANG === "zh" ? "格位判定" : "Grade audit");
    set("h-gua", t("gua")); set("h-syn", t("syn")); set("h-chat", t("chat"));
    const sub = (id, en) => { const e = $(id); if (e) { const sm = e.querySelector("small"); if (sm) sm.textContent = en; } };
    sub("h-bazi", "Four Pillars"); sub("h-dayun", "Ten-year cycles"); sub("h-liunian", "Annual");
    sub("h-zw", "Zi Wei Dou Shu"); sub("h-overall", "Overall"); sub("h-radar", "Seven Dimensions");
    sub("h-dims", "Breakdown"); sub("h-areas", "Life areas"); sub("h-read", "Reading");
    sub("h-school", "Schools"); sub("h-ss", "Stars & interactions"); sub("h-luck", "Cycles");
    sub("h-timeline", "Annual trend"); sub("h-month", "Monthly"); sub("h-event", "Back-test");
    sub("h-method", "Method"); sub("h-reading", "Detailed reading");
    sub("h-int", ""); sub("h-avatar", ""); sub("h-grade", "");
    sub("h-gua", "Plum Blossom"); sub("h-syn", "Synastry"); sub("h-chat", "Ask the model");
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
    // 静态表单标签：中文只留中文，英文只留英文
    const LAB = {
      "l-name": ["姓名", "Name"], "l-gender": ["性别", "Gender"], "l-cal": ["历法", "Calendar"],
      "l-date": ["生日", "Date"], "l-time": ["时间", "Time"], "l-lon": ["经度", "Longitude"],
      "l-customlon": ["经度值", "Longitude °E"],
      "g-l-date": ["起卦时间", "Date"], "g-l-time": ["时间", "Time"], "g-l-q": ["所占何事", "Question"],
      "s-l-rel": ["关系", "Relationship"], "s-l-name": ["对方姓名", "Name"],
      "s-l-gender": ["对方性别", "Gender"], "s-l-date": ["对方生日", "Date"],
      "s-l-time": ["时间", "Time"], "s-l-city": ["出生地", "Birthplace"],
    };
    Object.keys(LAB).forEach((id) => set(id, LAB[id][LANG === "zh" ? 0 : 1]));
    const ph = (id, txt) => { const e = $(id); if (e) e.placeholder = txt; };
    ph("g-q", LANG === "zh" ? "事业 / 感情 / 财运 …" : "career / love / money …");
    ph("cInput", LANG === "zh" ? "就这张命盘提问…" : "Ask about this chart…");
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
        <div class="ss">${tr(c.shishenGan)}</div>
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
        <div class="yr" style="color:${bandColor(d.score)}">${d.score.toFixed(0)} ${bandTxt(d.band)}</div>
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
      cell.dataset.br = p.branch;
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
      <div class="r"><span>${L("出生","Born")}</span><b>${b.birth.y}-${String(b.birth.m).padStart(2, "0")}-${String(b.birth.d).padStart(2, "0")} ${String(b.birth.h).padStart(2, "0")}:${String(b.birth.mi).padStart(2, "0")}${b.trueSolarApplied && b.trueSolar ? `<span style="color:var(--tx3);font-weight:400"> → 真太阳时 ${String(b.trueSolar.h).padStart(2, "0")}:${String(b.trueSolar.mi).padStart(2, "0")}</span>` : ""}</b></div>
      <div class="r"><span>${L("农历","Lunar")}</span><b>${ld.year} · ${ld.isLeap ? "闰" : ""}${ld.month}月${ld.day}日 ${z.hourBranch}时</b></div>
      <div class="r"><span>${L("四柱","Pillars")}</span><b class="gz">${b.pillars.map((p) => p.gan + p.zhi).join(" ")}</b></div>
      <div class="r"><span>${L("五行局 / 紫微","Bureau / Purple Star")}</span><b>${z.ju} · ${z.ziweiBranch}</b></div>
      <div class="r"><span>${L("命宫 / 身宫","Life / Body")}</span><b>${z.mingBranch} / ${z.shenBranch}</b></div>
      <div class="r"><span>${L("命主 / 身主","Rulers")}</span><b>${z.mingZhu} / ${z.shenZhu}</b></div>
      <div class="r"><span>${L("斗君","Dou Jun")}</span><b>${z.douJun}</b></div>
      <div class="r"><span>${L("生年四化","Birth sihua")}</span><b style="font-size:11px">${sihua}</b></div>
      <div class="r"><span>${L("格局","Patterns")}</span><b style="font-size:11px">${zs.patterns.map((p) => p.name).join("、") || "—"}</b></div>
      <div class="r"><span>${L("流年命宫","Annual palace")}</span><b>${R.ziweiYear.ganzhi} · ${R.ziweiYear.palace}</b></div>`;
    board.appendChild(c);
    $("zwLegend").innerHTML = `<span>主星后上标为庙旺得利平陷</span><span style="color:var(--teal)">辅星</span>
      <span style="color:var(--red)">煞星</span><span>灰字为杂曜</span>
      <span>四化：<span class="hua hua禄">禄</span><span class="hua hua权">权</span><span class="hua hua科">科</span><span class="hua hua忌">忌</span></span>
      <span>底部「长生 · 博士 · 岁前 · 将前」；右下为大限岁数</span>`;
  }

  function showPalace(p) {
    const z = R.ziwei;
    document.querySelectorAll(".cell.sel").forEach((c) => c.classList.remove("sel"));
    document.querySelectorAll('.cell[data-br="' + p.branch + '"]').forEach((c) => c.classList.add("sel"));
    document.querySelectorAll(".pal-chip.on").forEach((c) => c.classList.remove("on"));
    document.querySelectorAll('.pal-chip[data-br="' + p.branch + '"]').forEach((c) => c.classList.add("on"));
    const tbl = $("f-feixing").checked ? window.ML_DATA.SIHUA_FEIXING : window.ML_DATA.SIHUA_SANHE;
    const hua = {};
    tbl[p.gan].forEach((st, i) => { hua[st] = ["禄", "权", "科", "忌"][i]; });
    const fly = Object.keys(hua).map((st) => {
      const target = z.palaces.find((q) => q.stars.some((s) => s.name === st));
      return target ? `<span class="hua hua${hua[st]}">${hua[st]}</span> ${st} → ${target.name}` : "";
    }).filter(Boolean).join("　");
    const tri = [-4, 4, 6].map((o) => z.palaces.find((q) => q.index === ((p.index + o) % 12 + 12) % 12));
    const lis = (arr, cls) => arr.map((s) => `<span class="${cls}">${s.name}${s.hua ? "化" + s.hua : ""}${s.brightness ? "[" + s.brightness + "]" : ""}</span>`).join("　");
    const theme = (window.ML_DATA.I18N.zwPalace[p.name] || { zh: ["", ""], en: ["", ""] });
    $("palaceDetail").innerHTML = `
      <div style="margin-bottom:8px">${z.palaces.map((q) =>
        `<span class="pal-chip${q.branch === p.branch ? " on" : ""}" data-br="${q.branch}">${q.name}</span>`).join("")}</div>
      <div style="font-size:12.5px;color:var(--tx2);line-height:1.8;margin-bottom:8px;
        padding:8px 11px;background:#191c24;border-radius:7px;border-left:2px solid var(--amber)">
        <b style="color:var(--amber2)">${LANG === "zh" ? p.name : tr(p.name)}</b>
        <span style="color:var(--tx3)">— ${LANG === "zh" ? theme.zh[0] : theme.en[0]}：${LANG === "zh" ? theme.zh[1] : theme.en[1]}</span>
      </div>
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
      <div><span class="note">三方四正　</span>${tri.filter(Boolean).map((q) => `${q.name}(${q.gan}${q.branch})`).join("　")}</div>`;
    $("palaceDetail").querySelectorAll(".pal-chip").forEach((chip) => {
      chip.onclick = () => {
        const q = R.ziwei.palaces.find((x) => x.branch === chip.dataset.br);
        if (q) showPalace(q);
      };
    });
    annotate($("palaceDetail"));
  }

  /* ---------- score ---------- */
  const set2 = (id, txt) => { const e = $(id); if (e) e.textContent = txt; };

  function renderScore() {
    const s = R.scores, zs = R.zsummary, ue = ML.usefulElements(R.bazi);
    const g = R.grade || {};
    const bz = g.bazi || {}, zw = g.ziwei || {};
    $("gradeName").textContent = LANG === "zh" ? (g.grade || "—") : (g.gradeEn || "—");
    $("gradeScore").textContent = g.score ? `${g.score.toFixed(1)} / 100` : "";
    $("intVal").textContent = `${s.overall.toFixed(1)} · P${s.percentile.toFixed(0)}`;
    $("intBar").style.width = s.overall + "%";
    $("intBar").style.background = bandColor(s.overall);
    const gcol = (v) => v >= 74 ? "var(--amber2)" : v >= 60 ? "var(--teal)" : "var(--tx2)";
    $("gradeName").style.color = gcol(g.score || 0);
    $("tierNote").innerHTML = LANG === "zh"
      ? `${g.basis || ""}<br>
         <span style="color:var(--tx3)">格位判「贵贱」（成格 / 破格 / 救应），强度判「力量」（五行、调候、流通）。二者不互相折算——
         从格可以身弱而格高，身强之造也可以格低。</span><br>
         八字 <b style="color:${gcol(bz.score || 0)}">${bz.grade || "—"} ${(bz.score || 0).toFixed(1)}</b>
         · 紫微 <b style="color:${gcol(zw.score || 0)}">${zw.grade || "—"} ${(zw.score || 0).toFixed(1)}</b>
         · 高于随机命盘 <b>${s.percentile.toFixed(0)}%</b>`
      : `${g.basisEn || ""}`;

    // 成格 / 破格 / 救应 明细
    const it = (bz.items || []);
    const grp = (k, label, color) => {
      const rows = it.filter((i) => i.kind === k && i.ok);
      if (!rows.length) return "";
      return `<div style="margin-bottom:10px"><div style="font-size:10.5px;letter-spacing:.12em;color:${color};margin-bottom:4px">${label}</div>`
        + rows.map((i) => `<div class="note" style="color:var(--tx2);margin:2px 0">· ${bi(i.name)}<span style="color:var(--tx3)"> ${bi(i.note)}</span></div>`).join("")
        + `</div>`;
    };
    $("gradeBox").innerHTML = (bz.items
      ? `<div class="note" style="margin-bottom:8px">${LANG === "zh"
          ? `成格项得 <b>${bz.setupScore}</b>/${bz.setupMax}（${((bz.setupRatio || 0) * 100).toFixed(0)}%），破格扣 <b style="color:var(--red)">${bz.broken}</b>，救应返 <b style="color:var(--teal)">${bz.rescued}</b>。救应按 1.35 倍回补——《五言独步》「有病方为贵，无伤不是奇」。`
          : `Setup ${bz.setupScore}/${bz.setupMax}, breaks −${bz.broken}, rescues +${bz.rescued}.`}</div>` : "")
      + grp("setup", LANG === "zh" ? "成格" : "Established", "var(--teal)")
      + grp("break", LANG === "zh" ? "破格" : "Broken", "var(--red)")
      + grp("rescue", LANG === "zh" ? "救应" : "Rescued", "var(--blue)")
      + (zw.patterns && zw.patterns.length ? `<div style="margin-top:6px"><div style="font-size:10.5px;letter-spacing:.12em;color:var(--purple);margin-bottom:4px">${LANG === "zh" ? "紫微格局" : "Zi Wei patterns"}</div>`
        + zw.patterns.map((p) => `<div class="note" style="color:var(--tx2);margin:2px 0">· <b style="color:${p.status === "成立" ? "var(--teal)" : "var(--tx2)"}">${p.name}</b>（${p.status}）<span style="color:var(--tx3)"> ${p.note}</span></div>`).join("") + `</div>` : "");

    $("dims").innerHTML = Object.keys(s.dimensions).map((k) =>
      `<div class="dimrow"><span class="nm">${dimName(k)}</span>
       <span class="bar"><i style="width:${s.dimensions[k]}%;background:${bandColor(s.dimensions[k])}"></i></span>
       <span class="vl">${s.dimensions[k].toFixed(0)}</span></div>`).join("") +
      `<div class="note" style="margin-top:6px">${LANG === "zh" ? "权重：" : "Weights: "}${Object.keys(s.weights).map((k) => `${dimName(k)} ${(s.weights[k] * 100).toFixed(0)}%`).join(" · ")}</div>`;

    const az = { career: ["事业", "Career"], wealth: ["财富", "Wealth"], love: ["感情", "Love"],
      health: ["健康", "Health"], study: ["学业", "Study"], social: ["人脉", "Network"] };
    $("areas").innerHTML = Object.keys(s.areas).map((k) =>
      `<div class="dimrow"><span class="nm">${az[k][LANG === "zh" ? 0 : 1]}</span>
       <span class="bar"><i style="width:${s.areas[k]}%;background:${bandColor(s.areas[k])}"></i></span>
       <span class="vl">${s.areas[k].toFixed(0)}</span></div>`).join("");

    const b = R.bazi;
    $("bzread").innerHTML = `
      <dt>${LANG === "zh" ? "日主" : "Day master"}</dt><dd>${b.dayMaster}（${I18.wx[b.dayMasterWx]}）· ${LANG === "zh" ? b.strengthLabel : I18.strength[b.strengthLabel]} ${b.strength.toFixed(1)}%</dd>
      <dt>${LANG === "zh" ? "格局" : "Structure"}</dt><dd>${LANG === "zh" ? b.structure.name : (I18.structure[b.structure.name] || b.structure.name)}</dd>
      <dt></dt><dd class="note">${LANG === "zh" ? b.structure.basis : ""}</dd>
      <dt>${LANG === "zh" ? "调候" : "Climate"}</dt><dd>${b.tiaohou.sequence || "—"}</dd>
      <dt>${LANG === "zh" ? "喜用" : "Favourable"}</dt><dd>${ue.favor.map((f) => I18.wx[f]).join(" ")}</dd>
      <dt>${LANG === "zh" ? "忌神" : "Avoid"}</dt><dd>${ue.avoid.map((f) => I18.wx[f]).join(" ")}</dd>
      <dt>${LANG === "zh" ? "五行" : "Elements"}</dt><dd>${Object.keys(b.elementScores).map((k) => `<span class="${WX[k]}">${I18.wx[k]} ${b.elementScores[k].toFixed(1)}%</span>`).join("　")}</dd>`;
    const z = R.ziwei, dec = R.ziweiDecades.find((d) => d.active);
    $("zwread").innerHTML = `
      <dt>${LANG === "zh" ? "命宫" : "Life palace"}</dt><dd>${z.mingBranch} · ${R.zsummary.mingStars.map(tr).join(" / ") || "—"}</dd>
      <dt>${LANG === "zh" ? "身宫" : "Body palace"}</dt><dd>${z.shenBranch} · ${tr(R.zsummary.bodyPalace)}</dd>
      <dt>${LANG === "zh" ? "命主 / 身主" : "Rulers"}</dt><dd>${tr(z.mingZhu)} / ${tr(z.shenZhu)}</dd>
      <dt>${LANG === "zh" ? "五行局" : "Bureau"}</dt><dd>${LANG === "zh" ? z.ju : z.ju.replace("局", "")}</dd>
      <dt>${LANG === "zh" ? "格局" : "Patterns"}</dt><dd>${R.zsummary.patterns.map((p) => LANG === "zh" ? p.name : (I18.patternEn && I18.patternEn[p.name]) || p.name).join("、") || "—"}</dd>
      <dt></dt><dd class="note">${LANG === "zh" ? R.zsummary.patterns.map((p) => p.desc).join("；") : ""}</dd>
      <dt>${LANG === "zh" ? "大限" : "Decade"}</dt><dd>${dec ? `${dec.startAge}–${dec.endAge} · ${tr(dec.palace)} · ${LANG === "zh" ? dec.theme : ""}` : "—"}</dd>
      <dt>${LANG === "zh" ? "宫位分" : "Palace scores"}</dt><dd>${R.zsummary.mingScore.toFixed(0)} / ${R.zsummary.careerScore.toFixed(0)} / ${R.zsummary.wealthScore.toFixed(0)}</dd>`;

    $("hlBox").innerHTML = (s.highlights || []).map((x) => `<div class="note" style="color:var(--tx2);margin:3px 0">＋ ${bi(x)}</div>`).join("") || "—";
    $("wkBox").innerHTML = (s.weaknesses || []).map((x) => `<div class="note" style="color:var(--tx2);margin:3px 0">－ ${bi(x)}</div>`).join("") || "—";
    set2("h-hl", LANG === "zh" ? "结构亮点" : "Strengths");
    set2("h-wk", LANG === "zh" ? "结构短板" : "Deductions");
    $("schoolbox").innerHTML = schoolViews();
    const ss = b.shensha, rel = b.relations;
    const relZh = { 合: ["六合", "combination"], 冲: ["六冲", "clash"], 刑: ["刑", "punishment"],
      害: ["害", "harm"], 破: ["破", "destruction"], 干合: ["天干合", "stem combination"],
      干冲: ["天干冲", "stem clash"], 三合: ["三合", "triple harmony"],
      三会: ["三会", "directional"], 半合: ["半合", "half harmony"] };
    const groups = { 吉: [], 中: [], 凶: [] };
    Object.keys(ss).forEach((k) => groups[ss[k].nature].push(k));
    const gn = { 吉: ["吉", "Auspicious"], 中: ["中", "Neutral"], 凶: ["凶", "Inauspicious"] };
    $("ssbox").innerHTML = ["吉", "中", "凶"].map((g) =>
      `<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--tx3);letter-spacing:.1em">${gn[g][LANG === "zh" ? 0 : 1]}</span><br>` +
      (groups[g].length ? groups[g].map((k) =>
        `<span class="tag ${NAT[g]}" title="${LANG === "zh" ? ss[k].desc + "｜" + ss[k].basis : (I18.shensha[k] || k)}">${tr(k)}<span style="opacity:.65"> ${ss[k].positions.map((x) => LANG === "zh" ? x : ({ 年: "Y", 月: "M", 日: "D", 时: "H", 全局: "all" }[x])).join("")}</span></span>`).join("") : "—") +
      `</div>`).join("") +
      `<div style="border-top:1px solid var(--line);padding-top:8px">${Object.keys(rel).length
        ? Object.keys(rel).map((k) => `<span class="tag">${relZh[k][LANG === "zh" ? 0 : 1]}：${rel[k].map((x) => x.pair).join("　")}</span>`).join("")
        : "—"}</div>`;
    renderReading();
  }

  /* ---------- detailed reading ---------- */
  function renderReading() {
    const bs = ML.interpretBazi(R.bazi);
    const zs = ML.interpretZiwei(R.ziwei);
    const headZh = { structure: "格局与用神", shishen: "十神分布", pillars: "四柱宫位", shensha: "神煞与刑冲" };
    const headEn = { structure: "Structure & useful god", shishen: "Ten gods", pillars: "Four pillars", shensha: "Stars & clashes" };
    let html = `<h2 class="sec" id="h-bzdetail">${LANG === "zh" ? "八字详解" : "BaZi reading"}</h2>`;
    bs.forEach((sec) => {
      html += `<div class="card" style="margin-bottom:10px"><h4>${LANG === "zh" ? headZh[sec.key] : headEn[sec.key]}</h4>` +
        (LANG === "zh" ? sec.zh : sec.en).map((p) => `<p class="note" style="color:var(--tx2);margin:5px 0">${p}</p>`).join("") + `</div>`;
    });
    html += `<h2 class="sec">${LANG === "zh" ? "紫微十二宫详解" : "Zi Wei reading — twelve palaces"}</h2>`;
    html += `<div class="two" style="align-items:start">`;
    zs.forEach((sec, i) => {
      html += `<div class="card" style="margin-bottom:10px">
        <h4 style="color:var(--amber)">${LANG === "zh" ? sec.name : tr(sec.name)} <span style="color:var(--tx3);font-weight:400">${sec.branch}</span></h4>`
        + (LANG === "zh" ? sec.zh : sec.en).map((p) => `<p class="note" style="color:var(--tx2);margin:4px 0">${p}</p>`).join("") + `</div>`;
      if (i === 5) html += `</div><div class="two" style="align-items:start">`;
    });
    html += `</div>`;
    $("readingBox").innerHTML = html;
  }

  /* ---------- 术语提示 ---------- */
  const GLOS = window.ML_DATA.GLOSSARY || {};
  const TERM_KEYS = Object.keys(GLOS).sort((a, b) => b.length - a.length);
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const TERM_RE = TERM_KEYS.length ? new RegExp("(" + TERM_KEYS.map(escRe).join("|") + ")", "g") : null;
  let TIP = null;

  function initTips() {
    TIP = document.createElement("div");
    TIP.className = "t-tip";
    document.body.appendChild(TIP);
    const move = (e) => {
      if (!TIP.classList.contains("on")) return;
      const pad = 15, w = TIP.offsetWidth, h = TIP.offsetHeight;
      let x = e.clientX + pad, y = e.clientY + pad;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
      if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
      TIP.style.left = Math.max(8, x) + "px";
      TIP.style.top = Math.max(8, y) + "px";
    };
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest && e.target.closest(".t-term");
      if (!t) return;
      showTip(t.dataset.t); move(e);
    });
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest && e.target.closest(".t-term")) TIP.classList.remove("on");
    });
    document.addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest(".t-term");
      if (!t) { TIP.classList.remove("on"); return; }
      showTip(t.dataset.t); move(e);
    });
    document.addEventListener("scroll", () => TIP.classList.remove("on"), true);
  }

  function showTip(key) {
    const g = GLOS[key];
    if (!g || !TIP) return;
    TIP.innerHTML = `<div class="tt-h">${key}<span class="tt-c">${g.cat}</span></div>`
      + `<div>${LANG === "zh" ? g.zh : g.en}</div>`
      + `<div class="tt-en">${LANG === "zh" ? g.en : g.zh}</div>`;
    TIP.classList.add("on");
  }

  function annotate(root) {
    if (!root || !TERM_RE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const v = n.nodeValue;
        if (!v || v.length < 2) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest("script,style,.t-term,.gua-fig,.avatar,svg,textarea,select")) return NodeFilter.FILTER_REJECT;
        TERM_RE.lastIndex = 0;
        return TERM_RE.test(v) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);
    list.forEach((n) => {
      const txt = n.nodeValue;
      TERM_RE.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = TERM_RE.exec(txt))) {
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        const sp = document.createElement("span");
        sp.className = "t-term";
        sp.dataset.t = m[1];
        sp.textContent = m[1];
        frag.appendChild(sp);
        last = m.index + m[1].length;
      }
      if (last === 0) return;
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }

  /* ---------- 日主形象 ---------- */
  const AV = {
    甲: { wx: "木", c: "#7fc98a", name: "参天之木", en: "The Great Tree", slug: "jia",
      dEn: "Upright, aspiring, dependable — a tree that does not easily bend. The cost is inflexibility and an inability to appear weak.",
      d: "正直、向上、有担当，像一棵不会轻易弯腰的树。给人的第一印象是可靠，缺点是太直，不会拐弯，也不擅长示弱。" },
    乙: { wx: "木", c: "#8fd6a0", name: "藤蔓之木", en: "The Vine", slug: "yi",
      dEn: "Supple, resourceful, able to grow in cracks. Never meets force head-on, yet gets around it. The cost is dependence on a wall worth climbing.",
      d: "柔韧、善于借力、能在夹缝里生长。不与人硬碰，却能绕过去。缺点是容易依附，需要找到值得攀附的那面墙。" },
    丙: { wx: "火", c: "#e2635f", name: "太阳之火", en: "The Sun", slug: "bing",
      dEn: "Outward, bright, unable to hide anything — a light source wherever it goes. Built for the front. Burns out fast.",
      d: "外放、明亮、藏不住事，走到哪里都自带光源。天生适合站到人前，缺点是不耐寂寞，也容易烧得太快。" },
    丁: { wx: "火", c: "#e88a86", name: "灯烛之火", en: "The Candle", slug: "ding",
      dEn: "Quiet and persistent, lighting one small area to the end. Fine perception, strong intuition. The cost is burning its own wax.",
      d: "内敛而持久，专注照亮一小片地方。心思细、直觉准，擅长在暗处看清东西。缺点是容易耗自己。" },
    戊: { wx: "土", c: "#d3b06a", name: "城墙之土", en: "The City Wall", slug: "wu",
      dEn: "Heavy, stable, load-bearing. When others collapse, this one does not. The cost is immovability.",
      d: "厚重、稳、能扛事，别人塌的时候他不塌。缺点是不易变通，认定的事九头牛拉不回。" },
    己: { wx: "土", c: "#c9a870", name: "田园之土", en: "The Field", slug: "ji",
      dEn: "Warm, nourishing, tolerant — things grow near it. The cost is an inability to refuse, and being drained.",
      d: "温厚、能养人、包容度高，谁靠近都能长出东西来。缺点是不擅拒绝，容易被消耗。" },
    庚: { wx: "金", c: "#cfd4dc", name: "刀剑之金", en: "The Blade", slug: "geng",
      dEn: "Sharp, decisive, loyal — one clean cut, no dragging. The cost is that sharpness wounds others and itself.",
      d: "刚锐、果决、讲义气，做事一刀切下去不拖泥带水。缺点是锋利过头会伤人，也伤自己。" },
    辛: { wx: "金", c: "#dfe3ea", name: "珠玉之金", en: "The Jewel", slug: "xin",
      dEn: "Refined, sensitive, allergic to coarseness. Made for work that needs taste. The cost is caring too much what others see.",
      d: "精致、敏感、有审美洁癖，看不得粗糙。适合做需要品味的活。缺点是太在意别人的眼光。" },
    壬: { wx: "水", c: "#6aa9e0", name: "江河之水", en: "The River", slug: "ren",
      dEn: "Open, moving, unbounded — the more of the world it has seen, the stronger it runs. The cost is that it cannot be held.",
      d: "开阔、流动、不受拘束，见过的世面越多越有力量。缺点是难以被留住，也容易漫出来。" },
    癸: { wx: "水", c: "#8cc0e8", name: "雨露之水", en: "The Dew", slug: "gui",
      dEn: "Fine, penetrating — gets things done without a sound. Extremely empathetic. The cost is overthinking.",
      d: "细腻、渗透力强，无声无息就把事情做成了。共情能力极强。缺点是心思太重，容易内耗。" },
  };

  function renderAvatar() {
    const b = R.bazi;
    const a = AV[b.dayMaster] || AV["丙"];
    const male = ["male", "男", "m"].includes(b.gender);
    const src = `img/dz/${a.slug}_${male ? "m" : "f"}.webp`;
    const box = $("avatar");
    box.innerHTML = `<div class="ph">${b.dayMaster}</div>`
      + `<img src="${src}" alt="${b.dayMaster}" style="display:none"
          onload="this.style.display='block';this.parentNode.querySelector('.ph').style.display='none'"
          onerror="this.remove()">`
      + `<div class="tagline">${LANG === "zh" ? a.name + " · " + a.wx : a.en}</div>`;
    $("avName").textContent = LANG === "zh" ? `${b.dayMaster}${b.dayMasterWx} · ${a.name}` : `${b.dayMaster} ${I18.wx[b.dayMasterWx]} · ${a.en}`;
    $("avName").style.color = a.c;
    $("avDesc").textContent = LANG === "zh" ? a.d : a.dEn;
    const ue = ML.usefulElements(b);
    $("avMeta").innerHTML = LANG === "zh"
      ? `日主 <b style="color:${a.c}">${b.dayMaster}</b> 生于 ${b.month.zhi} 月，${b.strengthLabel}（同党 ${b.strength.toFixed(1)}%）。
         喜 <b style="color:var(--teal)">${ue.favor.join(" ")}</b>，忌 <b style="color:var(--red)">${ue.avoid.join(" ")}</b>。
         <span style="color:var(--tx3)">形象为象征性插画，按十天干的性质绘制，不代表相貌。</span>`
      : `Day master ${b.dayMaster} born in ${b.month.zhi} — ${I18.strength[b.strengthLabel]}. Favourable ${ue.favor.map((f) => I18.wx[f]).join(" ")}.`;
    annotate($("avMeta"));
  }

  /* ---------- 卦象 ---------- */
  function renderGua() {
    const dv = $("g-date").value || new Date().toISOString().slice(0, 10);
    const [y, mo, d] = dv.split("-").map(Number);
    const [h, mi] = ($("g-time").value || "12:00").split(":").map(Number);
    const q = ($("g-q").value || "").trim();
    const jd = ML.toJD(y, mo, d, h, mi);
    const ld = ML.lunarFromJD(jd);
    const yb = ((ld.year - 4) % 12 + 12) % 12 + 1;
    const hb = Math.floor(((h + 1) % 24) / 2) + 1;
    const g = ML.castGua(yb, ld.month, ld.day, hb);
    const zh = LANG === "zh";

    const fig = (lines, moving) => `<div class="gua-fig">` + lines.map((v, i) =>
      `<div class="gua-line${v ? "" : " yin"}${moving === i + 1 ? " mv" : ""}"></div>`).join("") + `</div>`;
    const TONE = zh ? { good: ["var(--teal)", "吉"], mid: ["var(--tx2)", "平"], bad: ["var(--red)", "凶"] }
      : { good: ["var(--teal)", "favourable"], mid: ["var(--tx2)", "mixed"], bad: ["var(--red)", "unfavourable"] };
    const t = TONE[g.tone] || TONE.mid;
    const t2 = TONE[g.resultTone] || TONE.mid;

    $("guaOut").innerHTML = `
      <div class="gua-box gua-main">
        ${fig(g.lines, g.moving)}
        <div>
          <div>
            <span class="gua-name">${zh ? g.name : g.nameEn}</span>
            <span class="gua-tr">${g.trace}</span>
            <span style="margin-left:12px;font-size:12px;color:${t[0]}">${t[1]}</span>
          </div>
          <div class="gua-text">${zh ? g.text : g.textEn}</div>
          <div class="gua-nums">${zh
            ? `上卦 ${g.upper}（${g.numbers.upper}）　下卦 ${g.lower}（${g.numbers.lower}）　动爻 第 ${g.moving} 爻　年月日数 ${g.numbers.sum}${q ? "　所问：" + q : ""}`
            : `Upper ${g.upper} (${g.numbers.upper}) · Lower ${g.lower} (${g.numbers.lower}) · moving line ${g.moving}${q ? " · question: " + q : ""}`}</div>
        </div>
      </div>
      <div class="gua-box">
        <h4>${zh ? "互卦 · 内在过程" : "Nuclear · inner process"}</h4>
        <div class="gua-name">${zh ? g.mutual : g.mutualEn}</div>
        <div class="gua-text">${zh ? g.mutualText : "The hidden process — what is really driving the situation."}</div>
      </div>
      <div class="gua-box">
        <h4>${zh ? "变卦 · 事情结果" : "Resulting · outcome"}</h4>
        <div class="gua-name" style="color:${t2[0]}">${zh ? g.result : g.resultEn}</div>
        <div class="gua-text">${zh ? g.resultText : "Where it lands if nothing else changes."}</div>
      </div>
      <div class="gua-box">
        <h4>${zh ? "体用 · 谁主谁客" : "Self & matter"}</h4>
        <div style="font-size:15px;margin:6px 0"><b style="color:var(--amber2)">${zh ? g.rel : g.relEn.split(" — ")[0]}</b></div>
        <div class="gua-text">${zh ? g.relZh : g.relEn}</div>
        <div class="gua-nums">${zh ? `体 ${g.ti}（${g.tiWx}）　用 ${g.yong}（${g.yongWx}）` : `self ${g.ti} (${g.tiWx}) · matter ${g.yong} (${g.yongWx})`}</div>
      </div>`;
    $("guaHint").innerHTML = zh
      ? `按《梅花易数》时间起卦：上卦取「年支数 + 农历月 + 农历日」除以八之余，下卦加时支数再除以八，动爻除以六。
         动爻所在之卦为「用」（所问之事），另一卦为「体」（自己）。本卦为当下，互卦为内在过程，变卦为结果。`
      : `Plum Blossom time casting: upper trigram from (year branch + lunar month + lunar day) mod 8, lower adds the hour branch, moving line mod 6.
         The trigram holding the moving line is the matter; the other is you. Primary = now, nuclear = hidden process, resulting = outcome.`;
  }

  /* ---------- 合盘 ---------- */
  function renderSyn() {
    const rel = $("s-rel").value || "couple";
    const dv = ($("s-date").value || "1997-10-10").split("-").map(Number);
    const [h, mi] = ($("s-time").value || "20:00").split(":").map(Number);
    const lon = +$("s-city").value || 116.4;
    const o = { name: $("s-name").value || "对方", gender: $("s-gender").value,
      y: dv[0], m: dv[1], d: dv[2], h, mi, lon, tz: 8,
      trueSolar: $("f-truesolar").checked,
      ziBoundary: $("f-zistart").checked ? "zi_start" : "zi_mid",
      sihuaSchool: $("f-feixing").checked ? "feixing" : "sanhe",
      leapPolicy: $("f-leapsplit").checked ? "split" : "same" };
    let other;
    try {
      other = ML.buildBazi(o);
    } catch (e) {
      $("synOut").innerHTML = `<div class="card"><div class="note">${LANG === "zh" ? "对方生日无效。" : "Invalid date."}</div></div>`;
      return;
    }
    const oz = ML.buildZiwei(o);
    const r = ML.synastry(R.bazi, other, R.ziwei, oz, rel);
    const cfg = window.ML_DATA.SYNASTRY[rel];
    const col = (v) => v >= 74 ? "var(--teal)" : v >= 58 ? "var(--amber2)" : "var(--red)";

    $("synOut").innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div class="syn-head">
          <div class="syn-side">
            <div class="meta">${LANG === "zh" ? "本人" : "You"}</div>
            <div class="four">${r.a.four}</div>
            <div class="meta">${r.a.dm}${LANG === "zh" ? r.a.dmWx : ""} · ${LANG === "zh" ? "强度" : "strength"} ${r.a.strength}%</div>
          </div>
          <div class="syn-mid">
            <div class="sc" style="color:${col(r.score)}">${r.score.toFixed(0)}</div>
            <div class="bd">${LANG === "zh" ? r.band : r.bandEn} · ${LANG === "zh" ? r.relationZh : r.relationEn}</div>
          </div>
          <div class="syn-side">
            <div class="meta">${LANG === "zh" ? "对方" : "Them"}</div>
            <div class="four">${r.b.four}</div>
            <div class="meta">${r.b.dm}${LANG === "zh" ? r.b.dmWx : ""} · ${LANG === "zh" ? "强度" : "strength"} ${r.b.strength}%</div>
          </div>
        </div>
        <div class="note" style="margin-top:10px;padding-top:9px;border-top:1px solid var(--line)">
          ${LANG === "zh" ? cfg.note : cfg.noteEn}</div>
      </div>
      <div class="card">
        ${r.items.map((it) => `
          <div class="syn-item">
            <div class="top"><span>${LANG === "zh" ? it.zh : it.en}
              <span style="color:var(--tx3);font-size:10.5px">${((r.weights[it.key] || 0) * 100).toFixed(0)}%</span></span>
              <b style="color:${col(it.score)}">${it.score.toFixed(0)}</b></div>
            <span class="bar"><i style="width:${it.score}%;background:${bandColor(it.score)}"></i></span>
            ${it.notes.map((n) => `<div class="why">· ${n.note}</div>`).join("")}
          </div>`).join("")}
      </div>`;
    annotate($("synOut"));
  }

  /* ---------- 流派视角（八派并列） ---------- */
  function schoolViews() {
    const b = R.bazi, s = R.scores, zs = R.zsummary, z = R.ziwei;
    const el = b.elementScores;
    const dom = Object.keys(el).sort((x, y) => el[y] - el[x])[0];
    const weak = Object.keys(el).sort((x, y) => el[x] - el[y])[0];
    const ue = ML.usefulElements(b);
    const g = R.grade || {};
    const names = LANG === "zh"
      ? { ziping: "① 子平 · 格局法（《子平真诠》）", tiaohou: "② 调候 · 《穷通宝鉴》", xinpai: "③ 新派 · 量化旺衰",
          mangpai: "④ 盲派 · 宾主与做功", nayin: "⑤ 纳音神煞派", sanhe: "⑥ 紫微三合派",
          feixing: "⑦ 紫微飞星派", heluo: "⑧ 河洛 · 宫位卦象" }
      : { ziping: "① Ziping · structure", tiaohou: "② Climate · Qiong Tong Bao Jian", xinpai: "③ Modern · quantified strength",
          mangpai: "④ Blind school · guest-host & work", nayin: "⑤ Sound-element & stars", sanhe: "⑥ Zi Wei Sanhe",
          feixing: "⑦ Zi Wei flying star", heluo: "⑧ Hetu-Luoshu · palace trigrams" };

    const rels = b.relations || {};
    const relTxt = ["合", "冲", "刑", "害", "破"].map((k) => (rels[k] && rels[k].length)
      ? `${k}：${rels[k].map((x) => x.pair).join("、")}` : "").filter(Boolean).join("；") || "无";

    const rows = LANG === "zh" ? [
      ["ziping", `取格依月令：${b.structure.basis}。${b.structure.kind === "特殊格"
        ? "特殊格局成败系于一点，不宜以常规喜忌套用——那一点被破则全局翻转。"
        : "普通格重在用神是否透出有力：格清而用神无力仍属平常，格浊而用神得力反能成事。"}
        以本引擎的成格度计，取格满足 ${((g.bazi && g.bazi.setupRatio) * 100 || 0).toFixed(0)}%，
        破格扣 ${(g.bazi && g.bazi.broken) || 0} 分、救应返 ${(g.bazi && g.bazi.rescued) || 0} 分，判为 <b>${(g.bazi && g.bazi.grade) || "—"}</b>。`],

      ["tiaohou", `《穷通宝鉴》${b.dayMaster}日生${b.month.zhi}月，调候取 <b>${b.tiaohou.sequence || "—"}</b>
        （${b.tiaohou.primary || "—"}为先）。已见 ${(b.tiaohou.satisfied || []).join("") || "无"}，
        缺 ${(b.tiaohou.missing || []).join("") || "无"}。
        ${(b.tiaohou.missing || []).length
          ? "调候有缺，代表环境给的支持不足；解法不在命里而在选择里——方位、行业属性、以及走到该五行流年时集中发力。"
          : "调候齐备，先天气候得宜，起手条件不差。"}`],

      ["xinpai", `按干支加权（月令 24%）叠加旺相休囚死系数：${dom}最旺 ${el[dom].toFixed(1)}%，
        ${weak}最弱 ${el[weak].toFixed(1)}%；同党合计 ${b.strength.toFixed(1)}%，判为 ${b.strengthLabel}。
        量化法的长处是可比、可追踪、可回测；短处是它不认「格局」的贵贱——
        一个从格在它眼里就是「身极弱」。所以本引擎把它只当七维中的一维，不作总判。`],

      ["mangpai", `盲派看「宾主」与「做功」：日主为主，财官为宾；合冲刑害是做功的方式。
        本局月令${b.month.zhi}主气${(b.pillars[1].hidden || [])[0] || ""}为${b.pillars[1].shishenZhi}，
        ${rels["合"] && rels["合"].length ? "有合：" + rels["合"].map((x) => x.pair).join("、") + "——合是取财官的手段；" : ""}
        ${rels["冲"] && rels["冲"].length ? "有冲：" + rels["冲"].map((x) => x.pair).join("、") + "——冲是破，也是动；" : ""}
        ${rels["刑"] && rels["刑"].length ? "有刑：" + rels["刑"].map((x) => x.pair).join("、") + "——刑主纠缠；" : ""}
        盲派不重旺衰而重「谁制谁、谁被制」，因此同一张盘在盲派眼里吉凶可能与其他派相反。
        这一派长于断具体事件与应期，短于系统化，故只作参照。`],

      ["nayin", `年柱纳音 ${b.year.nayin}，日柱纳音 ${b.day.nayin}。
        神煞共 ${Object.keys(b.shensha).length} 颗：吉 ${s.shenshaCount ? s.shenshaCount.good : "—"}、
        中 ${s.shenshaCount ? s.shenshaCount.mid : "—"}、凶 ${s.shenshaCount ? s.shenshaCount.bad : "—"}。
        纳音与神煞在明清以后被视为「末节」，本引擎给它们独立的「神煞吉凶」一维，
        权重 8%，既不让它主导结论，也不假装它不存在。
        古法原话是「神煞不压五行」——这句话本身就是给神煞定权重。`],

      ["sanhe", `三合派以三方四正与格局论命。命宫 ${z.mingBranch}，${zs.mingStars.join("、") || "空宫（借对宫）"}；
        三方四正得分 ${s.dimensions.sanfang}。${zs.patterns.length
          ? "成格：" + zs.patterns.map((p) => p.name + "（" + p.desc + "）").join("；")
          : "未成典型格局，按宫位单论"}。
        财帛 ${zs.wealthScore}、官禄 ${zs.careerScore}——
        ${zs.careerScore > zs.wealthScore ? "事业强于财帛，宜以职位与专业换资源。" : "财帛强于官禄，宜以经营与配置取胜。"}
        三合派对格局的成立条件有严格要求（需吉星加会且无煞），本引擎按此判定，故标为「有瑕」的格局仍算格局，只是成色打折。`],

      ["feixing", `飞星派不看静态星曜，只看四化往哪里飞。生年干 ${z.yearGan}，四化：
        ${Object.keys(z.sihua).map((k) => `${k}化${z.sihua[k]}`).join("、")}。
        ${(() => {
          const tbl = $("f-feixing").checked ? window.ML_DATA.SIHUA_FEIXING : window.ML_DATA.SIHUA_SANHE;
          const out = [];
          z.palaces.forEach((p) => {
            const h = {};
            (tbl[p.gan] || []).forEach((st, i) => { h[st] = ["禄", "权", "科", "忌"][i]; });
            Object.keys(h).forEach((st) => {
              const tgt = z.palaces.find((q) => q.stars.some((x) => x.name === st));
              if (tgt) out.push(`${p.name}化${h[st]}入${tgt.name}`);
            });
          });
          return out.slice(0, 6).join("；") || "—";
        })()}。
        飞星派的判词是「禄入则得、忌入则困、忌叠则凶」。本引擎在宫位详情里把每一宫的飞化都列了出来，可逐条核对。`],

      ["heluo", `河洛派把十二宫配后天八卦方位：${z.mingBranch}属${({
        子: "坎（水）", 丑: "艮（土）", 寅: "艮（土）", 卯: "震（木）", 辰: "巽（木）", 巳: "巽（木）",
        午: "离（火）", 未: "坤（土）", 申: "坤（土）", 酉: "兑（金）", 戌: "乾（金）", 亥: "乾（金）",
      })[z.mingBranch] || "—"}，身宫 ${z.shenBranch}。
        以卦位论，命宫落${["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"].includes((({
          子: "坎", 丑: "艮", 寅: "艮", 卯: "震", 辰: "巽", 巳: "巽", 午: "离", 未: "坤",
          申: "坤", 酉: "兑", 戌: "乾", 亥: "乾",
        })[z.mingBranch])) ? "八卦之正位" : "—"}，主气与先后天卦的配合决定格局的「象」。
        这一派在现代实践中多作辅助，本引擎给出宫位卦象，但不据此单独下断。`],
    ] : [
      ["ziping", `Structure from the month command: ${b.structure.name}. Setup ratio ${((g.bazi && g.bazi.setupRatio) * 100 || 0).toFixed(0)}%, breaks ${(g.bazi && g.bazi.broken) || 0}, rescues ${(g.bazi && g.bazi.rescued) || 0} — grade ${(g.bazi && g.bazi.grade) || "—"}.`],
      ["tiaohou", `Climate god ${b.tiaohou.sequence || "—"}; present ${(b.tiaohou.satisfied || []).join("") || "none"}, missing ${(b.tiaohou.missing || []).join("") || "none"}.`],
      ["xinpai", `${I18.wx[dom]} strongest ${el[dom].toFixed(1)}%, ${I18.wx[weak]} weakest ${el[weak].toFixed(1)}%; allies ${b.strength.toFixed(1)}% — ${I18.strength[b.strengthLabel]}.`],
      ["mangpai", `Guest-host reading: the day master is host, wealth and office are guests. Interactions — ${relTxt}.`],
      ["nayin", `Year nayin ${b.year.nayin}, day nayin ${b.day.nayin}; ${Object.keys(b.shensha).length} stars in three grades.`],
      ["sanhe", `Life palace ${z.mingBranch}: ${zs.mingStars.map(tr).join(", ") || "empty"}; trine ${s.dimensions.sanfang}; wealth ${zs.wealthScore}, career ${zs.careerScore}.`],
      ["feixing", `Birth-year stem ${z.yearGan}: ${Object.keys(z.sihua).map((k) => `${k}→${z.sihua[k]}`).join(", ")}.`],
      ["heluo", `Life palace ${z.mingBranch} on the Later-Heaven trigram wheel; body palace ${z.shenBranch}.`],
    ];

    return rows.map(([k, txt]) => {
      const nm = k === "sanhe" || k === "feixing" || k === "heluo" ? (nameCol(k, names, LANG)) : null;
      return `<div style="margin-bottom:15px"><div style="font-size:12px;color:var(--amber);letter-spacing:.08em;margin-bottom:4px">${names[k]}</div>
       <div class="note" style="color:var(--tx2)">${txt}</div></div>`;
    }).join("");
  }

  function nameCol(k, names, lang) {
    return names[k];
  }

  function drawRadar() {
    if (!R) return;
    const d = R.scores.dimensions, keys = Object.keys(d);
    const zh = { structure: "结构", flow: "流通", climate: "调候", root: "根基",
      ming: "命宫", sanfang: "三方", shensha: "神煞", yongshen: "用神" };
    const zhEn = { structure: "Struct", flow: "Flow", climate: "Climate", root: "Root",
      ming: "Palace", sanfang: "Trine", shensha: "Stars" };
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
      out += `<text x="${lx}" y="${ly}" fill="#a4a3a0" font-size="11" text-anchor="middle">${LANG === "zh" ? (zh[k] || k) : (zhEn[k] || k)}</text>`;
      out += `<text x="${lx}" y="${ly + 12}" fill="#e9e6df" font-size="10" text-anchor="middle">${d[k].toFixed(0)}</text>`;
    });
    $("radar").innerHTML = out;
  }

  /* ---------- years / months ---------- */
  function renderYears() {
    $("cycTable").innerHTML = `<thead><tr><th>${L("大运","Cycle")}</th><th>${L("年龄","Age")}</th><th>${L("年份","Years")}</th><th>${L("十神","Ten gods")}</th><th>${L("主导宫位","Palace")}</th><th></th></tr></thead><tbody>` +
      R.cycles.map((c) => {
        const dec = R.ziweiDecades.find((d) => d.startYear <= c.startYear + 5 && c.startYear + 5 <= d.endYear);
        return `<tr${c.active ? ' style="background:#221f18"' : ""}>
          <td><b style="font-family:var(--serif);font-size:15px;color:${c.active ? "var(--amber2)" : "var(--tx)"}">${c.label}</b></td>
          <td class="num" style="color:var(--tx2)">${c.startAge}–${c.endAge}</td>
          <td class="num" style="color:var(--tx2)">${c.startYear}–${c.endYear}</td>
          <td>${tr(c.shishenGan)} / ${tr(c.shishenZhi)}</td>
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

    $("yearTable").innerHTML = `<thead><tr><th>${L("年份","Year")}</th><th>${L("干支","Pillar")}</th><th>${L("大运","Cycle")}</th><th class="num">${L("评分","Score")}</th><th>${L("评级","Band")}</th><th>${L("主题","Theme")}</th><th>${L("注意事项","Watch")}</th></tr></thead><tbody>` +
      data.map((d) => `<tr>
        <td class="num">${d.name}<span style="color:var(--tx3)"> · ${d.age}</span></td>
        <td><b style="font-family:var(--serif)">${d.label}</b></td>
        <td>${d.luckCycle || "—"}</td>
        <td class="num" style="color:${bandColor(d.score)}">${d.score.toFixed(1)}</td>
        <td><span class="pill ${bandCls(d.score)}">${bandTxt(d.band)}</span></td>
        <td class="note">${d.themes.slice(0, 3).map(tr).join(" · ")}</td>
        <td class="note">${d.cautions.slice(0, 2).map(bi).join(LANG === "zh" ? "；" : "; ") || "—"}</td></tr>`).join("") + "</tbody>";
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
    $("monthTable").innerHTML = `<thead><tr><th>${L("区间","Period")}</th><th>${L("干支","Pillar")}</th><th class="num">${L("评分","Score")}</th><th>${L("评级","Band")}</th><th>${L("主题","Theme")}</th><th>${L("机会","Opening")}</th><th>${L("注意事项","Watch")}</th></tr></thead><tbody>` +
      d.map((m) => `<tr><td class="num">${m.name}</td><td><b style="font-family:var(--serif)">${m.label}</b></td>
        <td class="num" style="color:${bandColor(m.score)}">${m.score.toFixed(1)}</td>
        <td><span class="pill ${bandCls(m.score)}">${bandTxt(m.band)}</span></td>
        <td class="note">${m.themes.slice(0, 2).map(tr).join(" · ")}</td>
        <td class="note">${(m.opportunities || []).slice(0, 1).map(bi).join("") || "—"}</td>
        <td class="note">${(m.cautions || []).slice(0, 1).map(bi).join("") || "—"}</td></tr>`).join("") + "</tbody>";
  }

  /* ---------- events ---------- */
  function evRow(ev) {
    const row = document.createElement("div");
    row.className = "ev-row";
    const kinds = S.kindKeys.map((k, i) =>
      `<option value="${k}"${ev && ev.kind === k ? " selected" : ""}>${S.kinds[LANG][i]}</option>`).join("");
    const year = ev ? ev.year : (FOCUS - 2 + (document.querySelectorAll("#evList .ev-row").length || 0));
    const imp = ev ? ev.impact : 0;
    const label = (v) => v > 0 ? "+" + v : String(v);
    row.innerHTML = `
      <input type="number" class="ev-year" value="${year}">
      <select class="ev-kind">${kinds}</select>
      <input type="text" class="ev-note" placeholder="${LANG === "zh" ? "发生了什么" : "what happened"}" value="${ev ? (ev.note || "") : ""}">
      <span class="impact"><input type="range" class="ev-imp" min="-3" max="3" step="1" value="${imp}"><b>${label(imp)}</b></span>
      <button class="del" title="${LANG === "zh" ? "删除" : "remove"}">×</button>`;
    const rng = row.querySelector(".ev-imp"), out = row.querySelector(".impact b");
    const paint = () => {
      out.textContent = label(+rng.value);
      const v = +rng.value;
      out.style.color = v > 0 ? "var(--teal)" : v < 0 ? "var(--red)" : "var(--tx3)";
    };
    rng.oninput = paint;
    paint();
    row.querySelector(".del").onclick = () => row.remove();
    return row;
  }

  /* ---------- events ---------- */
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
      <div class="card" style="margin-top:10px"><h4>${t("verdict")}</h4><div class="note">${LANG === "zh" ? res.verdict : (res.verdictEn || res.verdict)}</div>
        <div class="note" style="margin-top:5px">校准权重：${Object.keys(res.weights).map((k) => `${k} ${res.weights[k].toFixed(2)}`).join(" · ")}</div></div>
      <div class="card" style="margin-top:10px;overflow-x:auto">
        <table class="dt"><thead><tr><th>${L("年份","Year")}</th><th>${L("干支","Pillar")}</th><th>${L("类型","Kind")}</th><th>${L("自评","Impact")}</th>
        <th class="num">引擎分</th><th class="num">校准分</th><th>吻合</th><th>说明</th></tr></thead><tbody>
        ${res.rows.map((r) => `<tr><td class="num">${r.year}</td><td><b style="font-family:var(--serif)">${r.ganzhi}</b></td>
          <td>${r.kindLabel}</td><td>${r.impact > 0 ? "＋" + r.impact : r.impact}</td>
          <td class="num" style="color:${bandColor(r.predicted)}">${r.predicted.toFixed(1)}</td>
          <td class="num">${r.calibrated.toFixed(1)}</td>
          <td>${r.agree ? '<span class="pill p-hi">吻合</span>' : '<span class="pill p-low">不符</span>'}</td>
          <td class="note">${r.note || (r.cautions[0] || "")}</td></tr>`).join("")}
        </tbody></table></div>`;
    $("shareHint").textContent = LANG === "zh"
      ? "这张卡是按你刚填的经历算出来的，不是模板。发出去的时候，它同时也是一份「这套算法愿意被检验」的声明。"
      : "Built from your own events, not a template. Posting it also states that the method is willing to be checked.";
    $("dlCard").textContent = LANG === "zh" ? "下载 PNG" : "Download PNG";
    drawShareCard();
  }

  /* ---------- method ---------- */
  function cast() {
    let y, mo, d;
    if ($("f-cal").value === "lunar") {
      const raw = ($("f-lunar").value || "").trim().replace(/[年月]/g, "-").replace(/日/g, "");
      const parts = raw.split("-").filter(Boolean);
      if (parts.length < 3) { alert(LANG === "zh" ? "农历格式：1990-4-21 或 1990-闰5-1" : "Lunar format: 1990-4-21 or 1990-leap5-1"); return; }
      const ly = +parts[0], isLeap = parts[1].includes("闰"), lm = parseInt(parts[1].replace("闰", ""), 10), lday = +parts[2];
      const jd = ML.lunarToJD(ly, lm, lday, isLeap);
      if (jd == null) { alert("该农历日期不存在"); return; }
      const s = ML.fromJD(jd);
      y = s[0]; mo = s[1]; d = s[2];
      $("f-date").value = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    } else {
      const v = ($("f-date").value || "1990-05-15").split("-").map(Number);
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
    const step = (n, fn) => { try { fn(); } catch (e) { window.__mlErr && window.__mlErr(n + ": " + e.message); throw e; } };
    step("bazi", renderBaziTable); step("dayun", renderDayun);
    step("liunian", renderLiunian); step("board", renderBoard);
    step("palace", () => showPalace(R.ziwei.palaces[0]));
    step("score", renderScore); step("radar", drawRadar);
    step("avatar", renderAvatar);
    step("years", renderYears); step("months", renderMonths);
    if (R.events) renderEventResult();
    annotate(document.querySelector("main"));
  }

  /* ---------- 分享卡：Canvas 2D 直绘，导出与所见完全一致 ---------- */
  const CARD = {
    w: 1200, h: 630, bg: "#0e1015", panel: "#14161c", line: "#272b35",
    tx: "#e9e5da", tx2: "#9a9a94", tx3: "#6b6d74",
    amber: "#e8a33d", teal: "#5dcaa5", red: "#e2635f",
    serif: '"Songti SC","Noto Serif CJK SC","Source Han Serif SC",Georgia,serif',
    sans: '-apple-system,"PingFang SC","Noto Sans CJK SC",system-ui,sans-serif',
  };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawShareCard() {
    const cv = $("shareCard");
    if (!cv) return;
    const dpr = 2;
    cv.width = CARD.w * dpr;
    cv.height = CARD.h * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ZH = LANG === "zh";
    const ev = R.events;

    ctx.fillStyle = CARD.bg;
    ctx.fillRect(0, 0, CARD.w, CARD.h);
    ctx.fillStyle = CARD.amber;
    ctx.fillRect(0, 0, 5, CARD.h);

    if (!ev || !ev.rows || !ev.rows.length) {
      ctx.fillStyle = CARD.tx3;
      ctx.font = `16px ${CARD.sans}`;
      ctx.textAlign = "center";
      ctx.fillText(ZH ? "先在上方填 3 条以上真实经历并点「开始对照」" : "Add three or more real events above, then run the back-test",
        CARD.w / 2, CARD.h / 2 - 8);
      ctx.fillStyle = CARD.line;
      ctx.font = `13px ${CARD.sans}`;
      ctx.fillText(ZH ? "卡片会按你的命中率自动生成" : "The card is generated from your own hit rate",
        CARD.w / 2, CARD.h / 2 + 20);
      ctx.textAlign = "left";
      return;
    }

    ctx.textAlign = "left";
    ctx.fillStyle = CARD.amber;
    ctx.font = `bold 12px ${CARD.sans}`;
    ctx.fillText(ZH ? "回 测 结 果" : "B A C K - T E S T", 72, 82);

    ctx.fillStyle = CARD.tx;
    ctx.font = `34px ${CARD.serif}`;
    ctx.fillText(ZH ? "它算错过，并且说得出是哪一年"
      : "It was wrong — and it can name the year", 72, 136);

    ctx.fillStyle = CARD.tx2;
    ctx.font = `15px ${CARD.sans}`;
    ctx.fillText(ZH
      ? `${ev.n} 条真实经历 · 引擎盲打分 · 命中率与偏差全部公开`
      : `${ev.n} real events · engine scored blind · hit rate and misses published`, 72, 172);

    ctx.strokeStyle = CARD.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(72, 198); ctx.lineTo(1128, 198); ctx.stroke();

    const missYear = (ev.misses && ev.misses.length)
      ? (ev.misses[0].year !== undefined ? ev.misses[0].year : ev.misses[0]) : null;
    const corr = ev.calibratedCorrelation != null ? ev.calibratedCorrelation : ev.correlation;
    const stats = [
      [ev.hitRate + "%", ZH ? "命中率" : "hit rate", CARD.amber],
      [Number(corr).toFixed(2), ZH ? "校准后相关" : "calibrated r", CARD.teal],
      [missYear == null ? "—" : String(missYear), ZH ? "判错的年份" : "missed year", CARD.red],
    ];
    stats.forEach(([val, label, col], i) => {
      const x = 72 + i * 336;
      ctx.fillStyle = col;
      ctx.font = `62px ${CARD.serif}`;
      ctx.fillText(String(val), x, 288);
      ctx.fillStyle = CARD.tx3;
      ctx.font = `13px ${CARD.sans}`;
      ctx.fillText(label, x + 2, 316);
    });

    const rows = ev.rows.slice(0, 8);
    const top = 358, base = 480, hgt = base - top;
    const step = 980 / rows.length;
    const bw = Math.min(34, step * 0.42);
    ctx.strokeStyle = CARD.line;
    ctx.beginPath(); ctx.moveTo(72, base); ctx.lineTo(1128, base); ctx.stroke();

    rows.forEach((r, i) => {
      const cx = 72 + step * i + step / 2;
      const ok = r.agree;
      const bh = Math.max(6, (r.predicted / 100) * hgt);
      ctx.fillStyle = ok ? "rgba(93,202,165,.34)" : "rgba(226,99,95,.34)";
      rr(ctx, cx - bw / 2, base - bh, bw, bh, 3);
      ctx.fill();
      ctx.strokeStyle = ok ? CARD.teal : CARD.red;
      ctx.lineWidth = 1.5;
      rr(ctx, cx - bw / 2, base - bh, bw, bh, 3);
      ctx.stroke();

      const ay = base - ((Math.max(-3, Math.min(3, r.impact)) + 3) / 6) * hgt;
      ctx.beginPath();
      ctx.arc(cx, ay, 6, 0, Math.PI * 2);
      ctx.fillStyle = CARD.tx;
      ctx.fill();
      ctx.strokeStyle = CARD.bg;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = CARD.tx2;
      ctx.font = `13px ${CARD.sans}`;
      ctx.textAlign = "center";
      ctx.fillText(String(r.year), cx, base + 26);
      ctx.fillStyle = CARD.tx3;
      ctx.font = `11px ${CARD.sans}`;
      ctx.fillText(r.ganzhi, cx, base + 44);
      ctx.textAlign = "left";
    });

    ctx.fillStyle = CARD.tx2;
    ctx.font = `14px ${CARD.sans}`;
    const verdict = String((ZH ? ev.verdict : ev.verdictEn) || ev.verdict || "").replace(/\s+/g, " ");
    ctx.fillText(verdict.length > 62 ? verdict.slice(0, 62) + "…" : verdict, 72, 566);

    ctx.fillStyle = CARD.amber;
    ctx.font = `bold 13px ${CARD.sans}`;
    ctx.fillText("bazi-ziwei-engine", 72, 596);
    ctx.fillStyle = CARD.tx3;
    ctx.font = `12px ${CARD.sans}`;
    ctx.fillText("weiwei0614.github.io/bazi-ziwei-engine", 208, 596);
    ctx.textAlign = "right";
    ctx.fillText(ZH ? "绿＝判对　红＝判错　圆点＝真实好坏" : "green = agreed · red = missed · dot = actual", 1128, 596);
    ctx.textAlign = "left";
  }

  /* ---------- 大模型问答 ---------- */
  const CHAT_KEY = "ml_chat_cfg";
  let CHAT_HISTORY = [];

  function chatCfg() {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "{}"); } catch (e) { return {}; }
  }

  function initChat() {
    const cfg = chatCfg();
    if (cfg.provider) $("c-provider").value = cfg.provider;
    // 首次打开：按第一个服务商预填，省得用户自己猜 base 与 model
    const first = $("c-provider").options[0].value.split("|");
    $("c-base").value = cfg.base || first[0];
    $("c-model").value = cfg.model || first[1];
    $("c-key").value = cfg.key || "";
    $("c-temp").value = cfg.temp == null ? 0.5 : cfg.temp;
    $("c-provider").onchange = () => {
      const v = $("c-provider").value;
      if (v === "custom") return;
      const [base, model] = v.split("|");
      $("c-base").value = base;
      $("c-model").value = model;
    };
    $("demoEv").onclick = () => { fillDemo(); $("runEv").click(); };
    $("dlCard").onclick = () => {
      const cv = $("shareCard");
      cv.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bazi-ziwei-backtest.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    };
    $("c-save").onclick = () => {
      localStorage.setItem(CHAT_KEY, JSON.stringify({
        provider: $("c-provider").value, base: $("c-base").value.trim().replace(/\/+$/, ""),
        model: $("c-model").value.trim(), key: $("c-key").value.trim(), temp: +$("c-temp").value || 0.5,
      }));
      flashChat(LANG === "zh" ? "设置已保存到本机浏览器，不会上传到任何服务器。" : "Saved locally in this browser only.");
    };
    $("cSend").onclick = sendChat;
    $("cInput").onkeydown = (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(); }
    };
    $("chatHint").innerHTML = LANG === "zh"
      ? "把你的 API Key 填在左侧，命盘摘要会自动随问题一起发送给你选定的模型。Key 只存在本机 localStorage，不经过本项目任何服务器。"
      : "Put your API key on the left; the chart summary is sent with each question to the provider you chose. The key stays in localStorage.";
    $("chatTip").innerHTML = LANG === "zh"
      ? "支持任何 OpenAI 兼容接口。<br>Key 仅存本机。"
      : "Any OpenAI-compatible endpoint.<br>Key stored locally.";
    const qs = LANG === "zh"
      ? ["今年适合换工作吗？", "我的用神到底是什么？", "哪一年最该注意健康？", "解释一下我的紫微命宫"]
      : ["Should I change jobs this year?", "What is my useful element?", "Which year needs health caution?", "Explain my life palace"];
    $("cQuick").innerHTML = qs.map((q) => `<button data-q="${q}">${q}</button>`).join("");
    $("cQuick").querySelectorAll("button").forEach((b) => {
      b.onclick = () => { $("cInput").value = b.dataset.q; sendChat(); };
    });
    if (!CHAT_HISTORY.length) {
      flashChat(LANG === "zh" ? "填入 API Key 后即可提问。命盘摘要会自动附上。" : "Add an API key, then ask. The chart summary is attached automatically.");
    } else {
      renderChat();
    }
  }

  function flashChat(text) {
    const log = $("cLog");
    const d = document.createElement("div");
    d.className = "msg sys";
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  // 示例经历（仅用于演示卡片形态，数字由引擎现算，不是写死的宣传值）
  const DEMO_EV = [
    [2016, "study", 1, "入职第一年"],
    [2018, "career", -2, "低谷：项目停摆"],
    [2019, "career", 1, "转正"],
    [2021, "career", -2, "最难的一年"],
    [2023, "career", 1, "转机"],
    [2025, "money", -1, "收入回落"],
  ];

  function fillDemo() {
    const list = $("evList");
    while (list.children.length < DEMO_EV.length) list.appendChild(evRow(null));
    DEMO_EV.forEach(([y, k, imp, note], i) => {
      const row = list.children[i];
      if (!row) return;
      row.querySelector(".ev-year").value = y;
      row.querySelector(".ev-kind").value = k;
      row.querySelector(".ev-note").value = note || "";
      const rng = row.querySelector(".ev-imp");
      rng.value = imp;
      rng.dispatchEvent(new Event("input"));
    });
  }

  function renderChat() {
    const log = $("cLog");
    log.innerHTML = "";
    CHAT_HISTORY.forEach((m) => {
      const d = document.createElement("div");
      d.className = "msg " + (m.role === "user" ? "me" : "ai");
      d.textContent = m.content;
      log.appendChild(d);
    });
    log.scrollTop = log.scrollHeight;
  }

  function chartContext() {
    const b = R.bazi, z = R.ziwei, s = R.scores, g = R.grade || {};
    const ue = ML.usefulElements(b);
    const cyc = R.cycles.find((c) => c.active) || R.cycles[0];
    const yrs = R.timeline.slice(0, 4).map((t) => `${t.name} ${t.label} ${t.score.toFixed(0)}(${t.band})`).join("；");
    const ss = Object.keys(b.shensha).slice(0, 14).join("、");
    return [
      `【命主】${b.gender === "female" ? "女" : "男"}，公历 ${b.birth.y}-${b.birth.m}-${b.birth.d} ${String(b.birth.h).padStart(2, "0")}:${String(b.birth.mi).padStart(2, "0")}`
        + (b.trueSolarApplied && b.trueSolar
          ? `（真太阳时 ${String(b.trueSolar.h).padStart(2, "0")}:${String(b.trueSolar.mi).padStart(2, "0")}）` : ""),
      `【四柱】${b.pillars.map((p) => p.gan + p.zhi).join(" ")}`,
      `【日主】${b.dayMaster}${b.dayMasterWx}，${b.strengthLabel}（同党 ${b.strength.toFixed(1)}%），喜 ${ue.favor.join("")}，忌 ${ue.avoid.join("")}`,
      `【格局】${b.structure.name}（${b.structure.basis}）`,
      `【调候】取 ${b.tiaohou.sequence || "—"}，已见 ${(b.tiaohou.satisfied || []).join("") || "无"}，缺 ${(b.tiaohou.missing || []).join("") || "无"}`,
      `【五行占比】${Object.keys(b.elementScores).map((k) => k + b.elementScores[k].toFixed(1) + "%").join(" ")}`,
      `【神煞】${ss}`,
      `【格位】${g.grade || "—"} ${g.score || "—"}（八字格 ${(g.bazi && g.bazi.grade) || "—"}，紫微格 ${(g.ziwei && g.ziwei.grade) || "—"}）；强度 ${s.overall} 分，高于随机命盘 ${s.percentile}%`,
      `【紫微】命宫 ${z.mingBranch}，${R.zsummary.mingStars.join("、") || "空宫"}；五行局 ${z.ju}；命主 ${z.mingZhu}／身主 ${z.shenZhu}；生年四化 ${Object.keys(z.sihua).map((k) => k + "化" + z.sihua[k]).join(" ")}`,
      `【当前大运】${cyc ? cyc.label + " " + cyc.startAge + "-" + cyc.endAge + "岁" : "—"}`,
      `【流年】${yrs}`,
    ].join("\n");
  }

  async function sendChat() {
    const text = ($("cInput").value || "").trim();
    if (!text) return;
    const cfg = chatCfg();
    if (!cfg.base || !cfg.model || !cfg.key) {
      flashChat(LANG === "zh" ? "请先在左侧填写 API Base、Model 和 Key，并点「保存设置」。" : "Fill in API base, model and key first.");
      return;
    }
    $("cInput").value = "";
    CHAT_HISTORY.push({ role: "user", content: text });
    renderChat();
    const log = $("cLog");
    const waiting = document.createElement("div");
    waiting.className = "msg ai";
    waiting.textContent = LANG === "zh" ? "思考中…" : "thinking…";
    log.appendChild(waiting);
    log.scrollTop = log.scrollHeight;

    const sys = (LANG === "zh"
      ? "你是一位严谨的八字与紫微斗数命理师。下面是提问者的命盘数据，请据此回答。要求：1) 结论要引用具体的干支、十神或宫位作为依据；2) 不确定的地方直接说不确定，不要编造；3) 不做医疗、法律、投资的确定性承诺；4) 用简体中文，分点作答，控制在 400 字以内。\n\n"
      : "You are a rigorous BaZi and Zi Wei practitioner. Answer from the chart data below. Cite specific stems, gods or palaces as evidence; say 'uncertain' rather than inventing; make no definitive medical, legal or investment claims. Reply in English, under 350 words.\n\n")
      + chartContext();

    try {
      const res = await fetch(cfg.base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          temperature: cfg.temp,
          messages: [{ role: "system", content: sys }]
            .concat(CHAT_HISTORY.slice(-8).map((m) => ({ role: m.role, content: m.content }))),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.error && (data.error.message || data.error.code)) || ("HTTP " + res.status));
      const reply = (data.choices && data.choices[0] && data.choices[0].message
        && data.choices[0].message.content) || "(empty)";
      waiting.remove();
      CHAT_HISTORY.push({ role: "assistant", content: reply });
      renderChat();
    } catch (e) {
      waiting.remove();
      flashChat((LANG === "zh" ? "请求失败：" : "Request failed: ") + e.message
        + (LANG === "zh" ? "（多为 Key 无效、余额不足、或该服务未开放浏览器跨域调用）" : " (bad key, no balance, or CORS blocked)"));
    }
  }

  function renderMethod() {
    const zh = LANG === "zh";
    const rows = zh ? [
      ["历法与节气",
        "太阳视黄经由截断 VSOP87 计算（含章动、光行差、FK5 修正），节气以牛顿迭代求 15° 整数倍时刻；朔望用 Meeus 第 49 章；农历按「无中气置闰」，以「日」为单位判定（GB/T 33661-2017 口径）。不依赖任何 200 年查表数据。"],
      ["四柱",
        "年柱立春换年，月柱十二节换月（五虎遁），日柱子初 / 子正换日可切，时柱五鼠遁。真太阳时 = 经度差 + 均时差，乌鲁木齐与北京时间可差约两小时。"],
      ["八字要素",
        "十神、藏干（本气 / 中气 / 余气加权）、纳音、十二长生、旬空、旺相休囚死、五行量化占比、日主强弱、格局（含建禄 / 月刃 / 从格 / 专旺）、调候（《穷通宝鉴》120 条）、全部合冲刑害破。"],
      ["神煞",
        "45 颗，分吉 / 中 / 凶三组。每颗都给出「落宫 + 依据」（如「日干丙帝旺之位」「年支酉查红鸾」），可逐条复核，不是黑箱。"],
      ["格位判定",
        "格位与强度分成两个数。格位按古法逐条审计：成格 12 项、破格 7 项、救应 5 项，救应按 1.35 倍回补（《五言独步》「有病方为贵，无伤不是奇」）。紫微吉格按「吉星加会且三煞不临命」判成立 / 有瑕。强度则是七维加权，两者不互相折算。"],
      ["紫微斗数",
        "寅首五虎遁定宫干、纳音定五行局、起紫微诀（商数宫前走，借数偶顺奇逆）安十四主星；六吉六煞、38 杂曜、长生 / 博士 / 将前 / 岁前四套十二神、小限、命主身主、斗君、生年四化与宫干自化全部入盘。"],
      ["流年与流月",
        "按《子平真诠》顺序：先看喜忌（地支为主）→ 再论十神吉凶 → 再看会合刑冲（有合先论合，合可解冲）→ 最后叠大运基调。大运吉而流年凶不至大凶，反之吉力打折。分数压缩在 40–88 之间，单年读数是倾向而非判决。"],
      ["校验",
        "历法与四柱：3,000 组随机时刻对 lunar-python，年月日时零误差。紫微：700 张盘对 iztro，命宫 / 五行局 / 宫干 / 十四主星 / 六吉六煞 / 38 杂曜 / 四套十二神 / 小限 / 大限全部一致（1 例主星差异源于朔日临界）。浏览器 JS 与 Python 逐字段比对，差异仅四舍五入。38 个单元测试。"],
      ["局限",
        "① 2050 年后 ΔT 只是预测，远期节气可能差数十秒；② 朔在午夜前数秒时农历可能差一天（约三十年一遇）；③ 评分权重是启发式的，请用「经历对照」校准；④ 本工具描述结构倾向，不预测具体事件。"],
    ] : [
      ["Calendar & solar terms",
        "Solar longitude from a truncated VSOP87 series with nutation, aberration and FK5 correction; terms solved by Newton iteration on 15° multiples; lunations from Meeus ch. 49; leap months by the 'no major term' rule judged at day granularity (GB/T 33661-2017). No 200-year lookup table."],
      ["Four pillars",
        "Year changes at Li Chun, month at the twelve 'jie' terms (Five Tiger rule), day at midnight or 23:00 (switchable), hour by the Five Rat rule. True solar time = longitude offset + equation of time."],
      ["BaZi components",
        "Ten gods, hidden stems (primary / middle / residual weighted), nayin, twelve stages, void branches, seasonal states, quantified element shares, day-master strength, structure, climate god (120 rules from Qiong Tong Bao Jian), and every clash / combination / punishment / harm."],
      ["Shensha",
        "45 stars in three grades. Each reports where it lands and which rule produced it — auditable, not a black box."],
      ["Grade vs strength",
        "Two separate numbers. Rank is judged by the classical audit: 12 setup conditions, 7 break conditions, 5 rescue conditions, with rescues weighted 1.35x. Zi Wei patterns require auxiliary stars present and no malefic in the life palace. Strength is a seven-dimension weighted score. They are never averaged together."],
      ["Zi Wei",
        "Palace stems by the Five Tiger rule, bureau by sound-element, Purple Star by the quotient/borrow method; 14 majors, 6+6 auxiliaries, 38 adjective stars, four sets of twelve gods, minor limits, life/body rulers, Dou Jun, birth-year and self transformations."],
      ["Annual & monthly",
        "Judged in the classical order: favourable elements first (branch-weighted), then ten-god auspiciousness, then combinations and clashes (combination resolves clash), then the decade tone. A good decade cushions a bad year; a bad decade discounts a good one. Scores are compressed to 40–88 — a tendency, not a verdict."],
      ["Validation",
        "Calendar and pillars: 3,000 random instants against lunar-python, zero mismatches on all four pillars. Zi Wei: 700 charts against iztro — palace, bureau, stems, 14 majors, 12 auxiliaries, 38 adjective stars, four sets of twelve gods, minor and decade limits all identical (one chart differs by a major star at a new-moon knife edge). Browser JS vs Python: field-by-field parity. 38 unit tests."],
      ["Limits",
        "(1) ΔT beyond 2050 is a prediction — far-future terms may drift by tens of seconds. (2) When a new moon falls seconds before midnight the lunar date can differ by a day (~once in 30 years). (3) Scoring weights are heuristic — calibrate with the back-test. (4) This describes structural tendencies, not specific events."],
    ];
    $("methodBox").innerHTML = rows.map(([h, body]) =>
      `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #21242c">
         <div style="font-size:12px;color:var(--amber);letter-spacing:.1em;margin-bottom:4px">${h}</div>
         <div class="note" style="color:var(--tx2);line-height:1.85">${body}</div>
       </div>`).join("");
  }

  /* ---------- wire ---------- */
  function activateFromHash() {
    const order = SECS;
    const h = (location.hash || "").replace("#", "");
    const i = order.indexOf(h);
    if (i < 0) return;
    document.querySelectorAll(".tab").forEach((x, j) => x.classList.toggle("on", j === i));
    document.querySelectorAll(".view").forEach((x) => x.classList.remove("on"));
    const v = $("v-" + h);
    if (v) { v.classList.add("on"); annotate(v); }
    if (h === "score") drawRadar();
    if (h === "gua" && !$("guaOut").children.length) renderGua();
    if (h === "syn" && !$("synOut").children.length) {
      try { renderSyn(); } catch (e) {
        $("synOut").innerHTML = `<div class="card"><div class="note" style="color:var(--red)">${e.message}</div></div>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    paintChrome();
    initTips();
    [0, 1, 2].forEach(() => $("evList").appendChild(evRow(null)));
    try { cast(); } catch (e) { window.__mlErr && window.__mlErr("cast: " + e.message); console.error(e); }

    // 卦象：默认今天
    $("g-date").value = new Date().toISOString().slice(0, 10);
    $("g-cast").onclick = renderGua;
    // 合盘：关系选项
    const rel = window.ML_DATA.SYNASTRY || {};
    $("s-rel").innerHTML = Object.keys(rel).map((k) =>
      `<option value="${k}">${rel[k].zh} / ${rel[k].en}</option>`).join("");
    $("s-run").onclick = renderSyn;
    initChat();
    try {
      if (new URLSearchParams(location.search).get("demo") === "1") {
        fillDemo();
        setTimeout(() => $("runEv").click(), 60);
      }
    } catch (e) { /* ignore */ }
    renderMethod(); activateFromHash();
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
        renderScore(); drawRadar(); renderAvatar();
        renderYears(); renderMonths(); renderEventResult(); drawShareCard();
        if ($("guaOut").children.length) renderGua();
        if ($("synOut").children.length) renderSyn();
      }
      initChat();
    try {
      if (new URLSearchParams(location.search).get("demo") === "1") {
        fillDemo();
        setTimeout(() => $("runEv").click(), 60);
      }
    } catch (e) { /* ignore */ }
      annotate(document.querySelector("main"));
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
