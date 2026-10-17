/* UI layer. All computation comes from engine.js. */
(function () {
  "use strict";
  const ML = window.ML;
  let LANG = "zh";
  let R = null;                 // current reading
  let EVENTS = [];

  const S = {
    tabs: { zh: ["命盘", "评分", "大运流年", "流月", "经历对照", "方法"], en: ["Chart", "Scores", "Decades", "Months", "Back-test", "Method"] },
    bazi: { zh: "四柱八字", en: "Four Pillars" },
    zw: { zh: "紫微斗数命盘", en: "Zi Wei Dou Shu Board" },
    overall: { zh: "综合格局", en: "Overall Structure" },
    radar: { zh: "六维评分", en: "Six Dimensions" },
    dims: { zh: "评分拆解", en: "Score Breakdown" },
    areas: { zh: "六领域", en: "Six Life Areas" },
    read: { zh: "命局解读", en: "Interpretation" },
    ss: { zh: "神煞与刑冲合害", en: "Stars & Interactions" },
    luck: { zh: "大运", en: "Ten-Year Cycles" },
    timeline: { zh: "流年走势", en: "Annual Trend" },
    month: { zh: "流月", en: "Monthly" },
    event: { zh: "经历对照", en: "Back-test Against Your Life" },
    method: { zh: "方法与校验", en: "Method & Validation" },
    pos: { zh: ["年柱", "月柱", "日柱", "时柱"], en: ["Year", "Month", "Day", "Hour"] },
    dm: { zh: "日主", en: "Day Master" },
    strength: { zh: "旺衰", en: "Strength" },
    structure: { zh: "格局", en: "Structure" },
    tiaohou: { zh: "调候", en: "Climate" },
    yongshen: { zh: "喜用", en: "Favourable" },
    jishen: { zh: "忌神", en: "Unfavourable" },
    hidden: { zh: "藏干", en: "Hidden" },
    nayin: { zh: "纳音", en: "Nayin" },
    stage: { zh: "长生", en: "Stage" },
    kong: { zh: "空亡", en: "Void" },
    year: { zh: "年", en: "Year" }, age: { zh: "年龄", en: "Age" },
    gz: { zh: "干支", en: "Pillar" }, luckc: { zh: "大运", en: "Decade" },
    score: { zh: "评分", en: "Score" }, band: { zh: "评级", en: "Band" },
    themes: { zh: "主题", en: "Themes" }, cautions: { zh: "注意事项", en: "Cautions" },
    opps: { zh: "机会", en: "Openings" }, range: { zh: "区间", en: "Window" },
    ziweiMeta: { zh: "紫微", en: "Zi Wei" },
    evHint: {
      zh: "填写 3 条以上真实经历（升学、换工作、迁移、婚恋、疾病、破财……），引擎会逐年比对它原本给出的评分，报告吻合率与相关系数，并重新拟合权重。这是唯一能验证这套模型对<b>你</b>是否有效的方法。",
      en: "Enter three or more real events (school, job change, relocation, marriage, illness, loss). The engine compares its own year scores against them, reports hit-rate and correlation, then refits the weights. This is the only way to test whether the model works for <b>you</b>."
    },
    kinds: { zh: ["事业", "财务", "感情", "健康", "学业", "迁移", "家庭", "失去"], en: ["Career", "Money", "Love", "Health", "Study", "Move", "Family", "Loss"] },
    kindKeys: ["career", "wealth", "love", "health", "study", "move", "family", "loss"],
    impact: { zh: "影响", en: "Impact" },
    note: { zh: "说明", en: "Note" },
    addEv: { zh: "+ 添加事件", en: "+ Add event" },
    runEv: { zh: "开始对照 · Calibrate", en: "Run back-test" },
    hit: { zh: "吻合率", en: "Hit rate" },
    corr: { zh: "相关系数", en: "Correlation" },
    corr2: { zh: "校准后相关系数", en: "After calibration" },
    verdict: { zh: "结论", en: "Verdict" },
    miss: { zh: "不吻合的年份", en: "Years that disagreed" },
    born: { zh: "出生", en: "Born" },
    lunar: { zh: "农历", en: "Lunar" },
    trueSolar: { zh: "真太阳时", en: "True solar" },
    ming: { zh: "命宫", en: "Life palace" },
    shen: { zh: "身宫", en: "Body palace" },
    ju: { zh: "五行局", en: "Five-element bureau" },
    ziweiStar: { zh: "紫微星", en: "Zi Wei star" },
    patterns: { zh: "格局", en: "Patterns" },
    bodyPalace: { zh: "身宫落", en: "Body in" },
    yearGan: { zh: "生年干", en: "Birth-year stem" },
    focus: { zh: "流年", en: "Year" },
    zwYear: { zh: "流年命宫", en: "Annual palace" },
    decade: { zh: "大限", en: "Decade" },
    themeCol: { zh: "主题", en: "Theme" },
    advice: { zh: "要点", en: "Focus" },
    note2: { zh: "评分为相对刻度，不构成任何决策建议。", en: "Scores are relative, not advice." }
  };
  const t = (k) => (S[k] && S[k][LANG]) || k;

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const bandCls = (s) => s >= 65 ? "p-hi" : s >= 45 ? "p-mid" : "p-low";
  const bandColor = (s) => s >= 70 ? "#5dcaa5" : s >= 58 ? "#8fc98a" : s >= 45 ? "#e8a33d" : s >= 32 ? "#e2855f" : "#e2635f";

  /* ---------- i18n chrome ---------- */
  function paintChrome() {
    const tabs = $("tabs"); tabs.innerHTML = "";
    const order = ["chart", "score", "year", "month", "event", "method"];
    ["命盘", "评分", "大运流年", "流月", "经历对照", "方法"].forEach((k, i) => {
      const d = el("div", "tab" + (i === 0 ? " on" : ""), S.tabs[LANG][i]);
      d.onclick = () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
        document.querySelectorAll(".view").forEach((x) => x.classList.remove("on"));
        d.classList.add("on"); $("v-" + order[i]).classList.add("on");
        if (order[i] === "score") drawRadar();
      };
      tabs.appendChild(d);
    });
    $("h-bazi").textContent = t("bazi"); $("h-zw").textContent = t("zw");
    $("h-overall").textContent = t("overall"); $("h-radar").textContent = t("radar");
    $("h-dims").textContent = t("dims"); $("h-areas").textContent = t("areas");
    $("h-read").textContent = t("read"); $("h-bzread").textContent = t("bazi");
    $("h-zwread").textContent = t("ziweiMeta"); $("h-ss").textContent = t("ss");
    $("h-luck").textContent = t("luck"); $("h-timeline").textContent = t("timeline");
    $("h-month").textContent = t("month"); $("h-event").textContent = t("event");
    $("h-method").textContent = t("method");
    $("evHint").innerHTML = t("evHint");
    $("addEv").textContent = t("addEv"); $("runEv").textContent = t("runEv");
    $("evHead").innerHTML = `<div>${t("year")}</div><div>${t("kindKeys") && S.kinds[LANG][0] ? "" : ""}${S.kinds[LANG][0] === "事业" ? "类型" : "Type"}</div><div>${t("note")}</div><div style="text-align:center">${t("impact")}</div><div></div>`;
    $("langBtn").textContent = LANG === "zh" ? "EN" : "中";
    $("l-name").textContent = LANG === "zh" ? "姓名 / Name" : "Name";
    $("l-gender").textContent = LANG === "zh" ? "性别 / Gender" : "Gender";
    $("l-date").textContent = LANG === "zh" ? "公历生日 / Date" : "Birth date";
    $("l-time").textContent = LANG === "zh" ? "出生时间 / Time" : "Birth time";
    $("l-lon").textContent = LANG === "zh" ? "出生地经度 / Longitude" : "Longitude";
    $("l-customlon").textContent = LANG === "zh" ? "经度值 / Longitude°" : "Longitude°";
    $("l-ts").textContent = LANG === "zh" ? "真太阳时" : "True solar time";
    $("l-zs").textContent = LANG === "zh" ? "子初换日 (23:00)" : "Day starts 23:00";
    $("l-fx").textContent = LANG === "zh" ? "飞星派四化" : "Feixing sihua";
    $("l-lp").textContent = LANG === "zh" ? "闰月分半" : "Split leap month";
    $("l-fy").textContent = LANG === "zh" ? "流年焦点" : "Focus year";
    $("go").textContent = LANG === "zh" ? "排盘 · Cast" : "Cast chart";
    $("foot").innerHTML = LANG === "zh"
      ? "命理引擎 · 零依赖 · 天文历法计算 · 八字与紫微斗数双系统 · 仅供研究与传统术数学习，不构成任何决策建议。"
      : "Mingli Engine · zero dependencies · astronomical calendar · BaZi + Zi Wei Dou Shu · for research and traditional-arts study only, not advice.";
  }

  /* ---------- render: chart ---------- */
  function renderChart() {
    const b = R.bazi, z = R.ziwei;
    const holder = $("pillars"); holder.innerHTML = "";
    b.pillars.forEach((p, i) => {
      const d = el("div", "pillar" + (p.position === "day" ? " day" : ""));
      d.innerHTML = `
        <div class="pos">${S.pos[LANG][i]}</div>
        <div class="gz"><span class="g wx-${p.ganWx}">${p.gan}</span><span class="z wx-${p.zhiWx}">${p.zhi}</span></div>
        <div class="sub">${p.position === "day" ? `<b style="color:var(--amber2)">${t("dm")}</b>` : p.shishenGan} · ${p.shishenZhi}</div>
        <div class="sub">${t("hidden")} ${p.hidden.join("")}</div>
        <div class="sub">${t("nayin")} ${p.nayin}</div>
        <div class="sub">${t("stage")} ${p.stage} · ${t("kong")} ${p.kong.join("")}</div>`;
      holder.appendChild(d);
    });

    // ziwei board
    const board = $("board"); board.innerHTML = "";
    const LAYOUT = [
      [1, 1, "巳"], [1, 2, "午"], [1, 3, "未"], [1, 4, "申"],
      [2, 1, "辰"], [2, 4, "酉"], [3, 1, "卯"], [3, 4, "戌"],
      [4, 1, "寅"], [4, 2, "丑"], [4, 3, "子"], [4, 4, "亥"]
    ];
    LAYOUT.forEach(([r, c, br]) => {
      const p = z.palaces.find((x) => x.branch === br);
      const cell = el("div", "cell");
      cell.style.gridRow = r; cell.style.gridColumn = c;
      const stars = p.stars.map((s) => {
        const cls = s.kind === "主星" ? "star major" : s.kind === "辅星" ? "star lucky" : (["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"].includes(s.name) ? "star bad" : "star");
        const hua = s.hua ? `<span class="hua hua${s.hua}">${s.hua}</span>` : "";
        const br2 = s.brightness ? `<span class="b">${s.brightness}</span>` : "";
        return `<span class="${cls}">${s.name}${hua}${br2}</span>`;
      }).join("");
      const dsh = R.ziweiDecades.find((x) => x.branch === p.branch);
      cell.innerHTML = `<div class="ph">${LANG === "zh" ? p.name : p.nameEn} <small>${p.gan}${p.branch}</small>${p.isBody ? ' <small style="color:var(--purple)">身</small>' : ""}<small style="float:right;color:#4d4d4a">${dsh ? dsh.startAge + "–" + dsh.endAge : ""}</small></div>
        <div class="st">${stars}</div><div class="bh">${p.branch}</div>`;
      board.appendChild(cell);
    });
    const c = el("div", "center");
    const zs = R.zsummary;
    c.innerHTML = `<h3>${LANG === "zh" ? "命盘总览" : "Chart Overview"}</h3>
      <div class="row"><span>${t("born")}</span><b>${b.birth.y}-${String(b.birth.m).padStart(2, "0")}-${String(b.birth.d).padStart(2, "0")} ${String(b.birth.h).padStart(2, "0")}:${String(b.birth.mi).padStart(2, "0")}</b></div>
      <div class="row"><span>${t("trueSolar")}</span><b>${R.bazi.trueSolarOffset >= 0 ? "+" : ""}${R.bazi.trueSolarOffset.toFixed(1)} min</b></div>
      <div class="row"><span>${t("lunar")}</span><b>${b.lunar.year} · ${b.lunar.isLeap ? "闰" : ""}${b.lunar.month}月${b.lunar.day}日</b></div>
      <div class="row"><span>${t("ju")}</span><b>${z.ju}</b></div>
      <div class="row"><span>${t("ming")} / ${t("shen")}</span><b>${z.mingBranch} / ${z.shenBranch}</b></div>
      <div class="row"><span>${t("ziweiStar")}</span><b>${z.ziweiBranch}</b></div>
      <div class="row"><span>${t("patterns")}</span><b>${zs.patterns.map((p) => p.name).join("、") || "—"}</b></div>
      <div class="row"><span>${t("yearGan")}</span><b>${z.yearGan} · ${z.decadeDirection > 0 ? (LANG === "zh" ? "顺行" : "forward") : (LANG === "zh" ? "逆行" : "reverse")}</b></div>`;
    board.appendChild(c);
    $("zwNote").textContent = LANG === "zh"
      ? "紫微盘按三合派安星，闰月按「前半月算本月、后半月算下月」处理；四化可在上方切换飞星派口径。"
      : "The board follows the Sanhe school; leap months are split at the 15th. Sihua can be switched to the Feixing school above.";
  }

  /* ---------- render: scores ---------- */
  function renderScore() {
    const s = R.scores;
    $("overall").textContent = s.overall.toFixed(1);
    $("tier").textContent = s.tier;
    const zs = R.zsummary;
    const ue0 = ML.usefulElements(R.bazi);
    $("tierNote").innerHTML = LANG === "zh"
      ? `<div style="line-height:2">日主 <b style="color:var(--amber2)">${R.bazi.dayMaster}${R.bazi.dayMasterWx}</b>，
         ${R.bazi.strengthLabel}（${R.bazi.strength.toFixed(0)}%）；格局 <b>${R.bazi.structure.name}</b>；
         紫微命宫 <b>${zs.mingStars.join(" / ") || "空宫"}</b>。<br>
         喜用 <b style="color:var(--teal)">${ue0.favor.join(" ")}</b>，忌 <b style="color:var(--red)">${ue0.avoid.join(" ")}</b>；
         调候取 ${R.bazi.tiaohou.sequence || "—"}。<br>
         <span style="color:var(--tx3)">评分是相对刻度：60 分以上为可用之局，75 分以上属同类中的优等。它不是命运的绝对值，只是结构张力的读数。</span></div>`
      : `<div style="line-height:2">Day master <b style="color:var(--amber2)">${R.bazi.dayMaster} ${R.bazi.dayMasterWx}</b>,
         ${R.bazi.strengthLabel} (${R.bazi.strength.toFixed(0)}%); structure <b>${R.bazi.structure.name}</b>;
         life palace <b>${zs.mingStars.join(" / ") || "empty"}</b>.<br>
         Favourable <b style="color:var(--teal)">${ue0.favor.join(" ")}</b>, avoid <b style="color:var(--red)">${ue0.avoid.join(" ")}</b>;
         climate god ${R.bazi.tiaohou.sequence || "—"}.<br>
         <span style="color:var(--tx3)">Scores are relative: above 60 is workable, above 75 is strong among peers. They read structural tension, not fate.</span></div>`;

    const dim = s.dimensions;
    const names = {
      structure: S.dims && "结构", flow: "流通", climate: "调候",
      ming: "命宫", sanfang: "三方", yongshen: "用神"
    };
    const zh = { structure: "结构格局", flow: "五行流通", climate: "调候得宜", ming: "紫微命宫", sanfang: "三方四正", yongshen: "用神得力" };
    const en = { structure: "Structure", flow: "Element flow", climate: "Climate", ming: "Life palace", sanfang: "Trine & opposite", yongshen: "Useful god" };
    $("dims").innerHTML = Object.keys(dim).map((k) => `
      <div class="dimrow"><span class="nm">${LANG === "zh" ? zh[k] : en[k]}</span>
      <span class="bar"><i style="width:${dim[k]}%;background:${bandColor(dim[k])}"></i></span>
      <span class="vl">${dim[k].toFixed(0)}</span></div>`).join("") +
      `<div class="legend">${LANG === "zh" ? "权重：" : "Weights: "}${Object.keys(s.weights).map((k) => `${LANG === "zh" ? zh[k] : en[k]} ${(s.weights[k] * 100).toFixed(0)}%`).join(" · ")}</div>`;

    const a = s.areas;
    const az = { career: "事业", wealth: "财富", love: "感情", health: "健康", study: "学业", social: "人脉" };
    const ae = { career: "Career", wealth: "Wealth", love: "Love", health: "Health", study: "Study", social: "Network" };
    $("areas").innerHTML = Object.keys(a).map((k) => `
      <div class="dimrow"><span class="nm">${LANG === "zh" ? az[k] : ae[k]}</span>
      <span class="bar"><i style="width:${a[k]}%;background:${bandColor(a[k])}"></i></span>
      <span class="vl">${a[k].toFixed(0)}</span></div>`).join("");

    const b = R.bazi;
    const ue = ML.usefulElements(b);
    $("bzread").innerHTML = `
      <dt>${t("dm")}</dt><dd>${b.dayMaster}（${b.dayMasterWx}）· ${b.strengthLabel} ${b.strength.toFixed(1)}%</dd>
      <dt>${t("structure")}</dt><dd>${b.structure.name}</dd>
      <dt></dt><dd class="note">${b.structure.basis}</dd>
      <dt>${t("tiaohou")}</dt><dd>${b.tiaohou.sequence || "—"}　${LANG === "zh" ? "已见" : "present"}: ${b.tiaohou.satisfied.join("") || (LANG === "zh" ? "无" : "none")}　${LANG === "zh" ? "缺" : "missing"}: ${b.tiaohou.missing.join("") || (LANG === "zh" ? "无" : "none")}</dd>
      <dt>${t("yongshen")}</dt><dd>${ue.favor.join(" ")}（${ue.favor.map((x) => ({ 木: "Wood", 火: "Fire", 土: "Earth", 金: "Metal", 水: "Water" }[x])).join(" / ")}）</dd>
      <dt>${t("jishen")}</dt><dd>${ue.avoid.join(" ")}</dd>
      <dt>${LANG === "zh" ? "五行占比" : "Elements"}</dt><dd>${{ 木: "木", 火: "火", 土: "土", 金: "金", 水: "水" } && Object.keys(b.elementScores).map((k) => `<span class="wx-${k}">${k} ${b.elementScores[k].toFixed(1)}%</span>`).join("　")}</dd>`;

    const z = R.ziwei;
    const dec = R.ziweiDecades.find((d) => d.active);
    $("zwread").innerHTML = `
      <dt>${t("ming")}</dt><dd>${z.mingBranch} · ${R.zsummary.mingStars.join(" / ") || (LANG === "zh" ? "空宫（借对宫）" : "empty")}</dd>
      <dt>${t("bodyPalace")}</dt><dd>${z.shenBranch} · ${R.zsummary.bodyPalace}</dd>
      <dt>${t("ju")}</dt><dd>${z.ju}</dd>
      <dt>${t("patterns")}</dt><dd>${R.zsummary.patterns.map((p) => `${p.name}`).join("、") || "—"}</dd>
      <dt></dt><dd class="note">${R.zsummary.patterns.map((p) => p.desc).join("；") || ""}</dd>
      <dt>${t("decade")}</dt><dd>${dec ? `${dec.startAge}–${dec.endAge} ${LANG === "zh" ? "岁" : "y"} · ${LANG === "zh" ? dec.palace : dec.palace} · ${dec.theme}` : "—"}</dd>
      <dt>${t("zwYear")}</dt><dd>${R.ziweiYear.ganzhi} → ${R.ziweiYear.palace}（${R.ziweiYear.score.toFixed(0)}）</dd>
      <dt>${LANG === "zh" ? "命宫分" : "Life score"}</dt><dd>${R.zsummary.mingScore.toFixed(1)}</dd>`;

    const ss = b.shensha, rel = b.relations;
    const relZh = { 合: "六合", 冲: "六冲", 刑: "刑", 害: "害", 破: "破", 干合: "天干合", 干冲: "天干冲", 三合: "三合", 三会: "三会", 半合: "半合" };
    $("schoolbox").innerHTML = schoolViews();
    $("ssbox").innerHTML = `
      <div style="margin-bottom:10px">${Object.keys(ss).length ? Object.keys(ss).map((k) => `<span class="star" style="margin:2px">${k} <b style="color:var(--amber)">${ss[k].join("")}</b></span>`).join("") : "—"}</div>
      <div>${Object.keys(rel).length ? Object.keys(rel).map((k) => `<span class="star" style="margin:2px">${relZh[k] || k}：${rel[k].map((x) => x.pair).join("　")}</span>`).join("") : "—"}</div>`;
  }

  function schoolViews() {
    const b = R.bazi, ue = ML.usefulElements(b), s = R.scores;
    const zs = R.zsummary, z = R.ziwei;
    const el = b.elementScores;
    const dom = Object.keys(el).sort((x, y) => el[y] - el[x])[0];
    const weak = Object.keys(el).sort((x, y) => el[x] - el[y])[0];
    const ZH = {
      ziping: "子平 · 格局法",
      tiaohou: "调候 · 穷通宝鉴",
      xinpai: "新派 · 量化旺衰",
      ziwei: "紫微 · 三方四正"
    };
    const EN = {
      ziping: "Ziping · structure",
      tiaohou: "Climate · Qiong Tong Bao Jian",
      xinpai: "Modern · quantitative strength",
      ziwei: "Zi Wei · trine & opposite"
    };
    const rows = [];
    if (LANG === "zh") {
      rows.push(["ziping", `月令${b.month.zhi}，${b.structure.basis}。格局${b.structure.kind === "特殊格" ? "特殊，成败系于一点，不宜以常规喜忌论" : "属普通格，重在用神是否透出有力"}。` +
        `日主${b.strengthLabel}，${b.strength >= 52 ? "宜泄宜克，不宜再补" : b.strength <= 45 ? "宜生宜扶，忌再耗泄" : "中和可任财官，取用弹性较大"}。`]);
      rows.push(["tiaohou", `《穷通宝鉴》${b.dayMaster}日生${b.month.zhi}月，调候取${b.tiaohou.sequence || "—"}（${b.tiaohou.primary || "—"}为先）。` +
        `已见 ${b.tiaohou.satisfied.join("") || "无"}，缺 ${b.tiaohou.missing.join("") || "无"}。` +
        `${b.tiaohou.missing.length ? "调候有缺，主环境给的支持不足，需靠后天补（方位、行业、择时）。" : "调候齐备，先天气候得宜，起手条件不差。"}`]);
      rows.push(["xinpai", `按干支加权（月令 24 %）叠加旺相休囚死系数，${dom}最旺（${el[dom].toFixed(1)}%），${weak}最弱（${el[weak].toFixed(1)}%）。` +
        `同党合计 ${b.strength.toFixed(1)}%，判为${b.strengthLabel}。量化法的长处是可比、可追踪；短处是它不认「格局」的贵贱，` +
        `因此本引擎把它只当六维中的一维，不做总判。`]);
      rows.push(["ziwei", `命宫${z.mingBranch}，${zs.mingStars.join("、") || "空宫（借对宫）"}；三方四正得分 ${s.dimensions.sanfang}。` +
        `${zs.patterns.length ? "成格：" + zs.patterns.map((p) => p.name + "（" + p.desc + "）").join("；") : "未成典型格局，按宫位单论"}。` +
        `财帛 ${zs.wealthScore}、官禄 ${zs.careerScore}——${zs.careerScore > zs.wealthScore ? "事业强于财帛，宜以职位与专业换资源" : "财帛强于官禄，宜以经营与配置取胜"}。`]);
    } else {
      rows.push(["ziping", `Month command ${b.month.zhi}: ${b.structure.basis}. ` +
        `Structure is ${b.structure.kind === "特殊格" ? "exceptional — outcome hinges on one point, ordinary favourable-element logic does not apply" : "ordinary — what matters is whether the useful god is transparent and rooted"}. ` +
        `Day master is ${b.strengthLabel}; ${b.strength >= 52 ? "drain and control it, do not reinforce" : b.strength <= 45 ? "support it, stop draining" : "balanced enough to carry wealth and office"}.`]);
      rows.push(["tiaohou", `${b.dayMaster} born in ${b.month.zhi} month: the climate god is ${b.tiaohou.sequence || "—"} (${b.tiaohou.primary || "—"} first). ` +
        `Present ${b.tiaohou.satisfied.join("") || "none"}, missing ${b.tiaohou.missing.join("") || "none"}. ` +
        `${b.tiaohou.missing.length ? "A missing climate stem means the environment under-supports you; compensate by direction, industry and timing." : "Climate is complete — the starting conditions are not bad."}`]);
      rows.push(["xinpai", `Weighted stems and branches (month command 24 %) times seasonal multipliers: ${dom} strongest (${el[dom].toFixed(1)} %), ${weak} weakest (${el[weak].toFixed(1)} %). ` +
        `Allies total ${b.strength.toFixed(1)} %, hence ${b.strengthLabel}. Quantification is comparable and trackable, but it ignores the nobility of a structure — ` +
        `which is why it counts as one dimension of six here, never as the verdict.`]);
      rows.push(["ziwei", `Life palace at ${z.mingBranch}: ${zs.mingStars.join(", ") || "empty (borrow opposite)"}; trine score ${s.dimensions.sanfang}. ` +
        `${zs.patterns.length ? "Patterns: " + zs.patterns.map((p) => p.name).join(", ") : "No canonical pattern; read palace by palace"}. ` +
        `Wealth ${zs.wealthScore} vs career ${zs.careerScore} — ${zs.careerScore > zs.wealthScore ? "career outranks wealth: convert position and expertise into resources" : "wealth outranks career: win through operation and allocation"}.`]);
    }
    return rows.map(([k, txt]) =>
      `<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--amber);letter-spacing:.08em;margin-bottom:4px">${LANG === "zh" ? ZH[k] : EN[k]}</div>
       <div class="note" style="color:var(--tx2)">${txt}</div></div>`).join("");
  }

  function drawRadar() {
    if (!R) return;
    const svg = $("radar");
    const d = R.scores.dimensions, keys = Object.keys(d);
    const zh = { structure: "结构", flow: "流通", climate: "调候", ming: "命宫", sanfang: "三方", yongshen: "用神" };
    const en = { structure: "Struct", flow: "Flow", climate: "Climate", ming: "Palace", sanfang: "Trine", yongshen: "God" };
    const cx = 160, cy = 150, rad = 100, n = keys.length;
    let out = "";
    for (let ring = 1; ring <= 4; ring++) {
      const rr = rad * ring / 4;
      const pts = keys.map((_, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      }).join(" ");
      out += `<polygon points="${pts}" fill="none" stroke="#272b34" stroke-width="1"/>`;
    }
    keys.forEach((_, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      out += `<line x1="${cx}" y1="${cy}" x2="${cx + rad * Math.cos(a)}" y2="${cy + rad * Math.sin(a)}" stroke="#272b34"/>`;
    });
    const pts = keys.map((k, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      const rr = rad * Math.max(0.04, d[k] / 100);
      return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    }).join(" ");
    out += `<polygon points="${pts}" fill="rgba(232,163,61,.20)" stroke="#e8a33d" stroke-width="1.8"/>`;
    keys.forEach((k, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      const rr = rad * Math.max(0.04, d[k] / 100);
      out += `<circle cx="${cx + rr * Math.cos(a)}" cy="${cy + rr * Math.sin(a)}" r="3" fill="#f3c26b"/>`;
      const lx = cx + (rad + 24) * Math.cos(a), ly = cy + (rad + 24) * Math.sin(a);
      out += `<text x="${lx}" y="${ly}" fill="#a4a3a0" font-size="11" text-anchor="middle" dominant-baseline="middle">${LANG === "zh" ? zh[k] : en[k]}</text>`;
      out += `<text x="${lx}" y="${ly + 13}" fill="#e9e6df" font-size="10" text-anchor="middle" dominant-baseline="middle">${d[k].toFixed(0)}</text>`;
    });
    svg.innerHTML = out;
  }

  /* ---------- render: years ---------- */
  function renderYears() {
    const ct = $("cycTable");
    ct.innerHTML = `<thead><tr><th>${t("gz")}</th><th>${t("age")}</th><th>${t("range")}</th><th>${LANG === "zh" ? "十神" : "Ten god"}</th><th></th></tr></thead><tbody>` +
      R.cycles.map((c) => `<tr${c.active ? ' style="background:#221f18"' : ""}>
        <td><b style="font-family:var(--serif);font-size:15px;color:${c.active ? "var(--amber2)" : "var(--tx)"}">${c.label}</b></td>
        <td class="num">${c.startAge}–${c.endAge}</td>
        <td class="num">${c.startYear}–${c.endYear}</td>
        <td>${c.shishenGan} / ${c.shishenZhi}</td>
        <td>${c.active ? `<span class="pill p-mid">${LANG === "zh" ? "当前" : "now"}</span>` : ""}</td></tr>`).join("") + "</tbody>";

    // line chart
    const svg = $("yearChart"), W = 900, H = 220, pad = 34;
    const data = R.timeline, n = data.length;
    const x = (i) => pad + i * (W - pad * 2) / (n - 1);
    const y = (v) => H - pad - (v / 100) * (H - pad * 2);
    let g = "";
    [25, 50, 75].forEach((v) => {
      g += `<line x1="${pad}" y1="${y(v)}" x2="${W - pad}" y2="${y(v)}" stroke="#262a32" stroke-dasharray="${v === 50 ? "0" : "3 4"}"/>`;
      g += `<text x="${pad - 6}" y="${y(v) + 3}" fill="#5b5b58" font-size="10" text-anchor="end">${v}</text>`;
    });
    const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.score)}`).join(" ");
    const area = line + ` L${x(n - 1)},${H - pad} L${x(0)},${H - pad} Z`;
    g += `<path d="${area}" fill="url(#g1)" opacity=".55"/><path d="${line}" fill="none" stroke="#e8a33d" stroke-width="2"/>`;
    g += `<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8a33d" stop-opacity=".38"/><stop offset="1" stop-color="#e8a33d" stop-opacity="0"/></linearGradient></defs>`;
    data.forEach((d, i) => {
      g += `<circle cx="${x(i)}" cy="${y(d.score)}" r="3.4" fill="${bandColor(d.score)}"/>`;
      g += `<text x="${x(i)}" y="${H - pad + 15}" fill="#71716e" font-size="10" text-anchor="middle">${d.name.slice(2)}</text>`;
      g += `<text x="${x(i)}" y="${y(d.score) - 9}" fill="#a4a3a0" font-size="9.5" text-anchor="middle">${d.score.toFixed(0)}</text>`;
    });
    svg.innerHTML = g;

    $("yearTable").innerHTML = `<thead><tr><th>${t("year")}</th><th>${t("gz")}</th><th>${t("luckc")}</th><th class="num">${t("score")}</th><th>${t("band")}</th><th>${t("themes")}</th><th>${t("cautions")}</th></tr></thead><tbody>` +
      data.map((d) => `<tr>
        <td class="num">${d.name}<span style="color:var(--tx3)"> · ${d.age}</span></td>
        <td><b style="font-family:var(--serif)">${d.label}</b></td>
        <td>${d.luckCycle || "—"}</td>
        <td class="num" style="color:${bandColor(d.score)}">${d.score.toFixed(1)}</td>
        <td><span class="pill ${bandCls(d.score)}">${d.band}</span></td>
        <td class="note">${d.themes.slice(0, 3).join(" · ")}</td>
        <td class="note">${d.cautions.slice(0, 2).join("；") || "—"}</td></tr>`).join("") + "</tbody>";
  }

  /* ---------- render: months ---------- */
  function renderMonths() {
    const d = R.months, W = 900, H = 200, pad = 30;
    const bw = (W - pad * 2) / d.length;
    let g = "";
    [25, 50, 75].forEach((v) => {
      const y = H - pad - (v / 100) * (H - pad * 2);
      g += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#262a32" stroke-dasharray="${v === 50 ? "0" : "3 4"}"/>`;
    });
    d.forEach((m, i) => {
      const h = ((m.score) / 100) * (H - pad * 2);
      const x = pad + i * bw + 4, y = H - pad - h;
      g += `<rect x="${x}" y="${y}" width="${bw - 8}" height="${h}" rx="3" fill="${bandColor(m.score)}" opacity=".82"/>`;
      g += `<text x="${x + (bw - 8) / 2}" y="${y - 5}" fill="#a4a3a0" font-size="9.5" text-anchor="middle">${m.score.toFixed(0)}</text>`;
      g += `<text x="${x + (bw - 8) / 2}" y="${H - pad + 14}" fill="#71716e" font-size="9.5" text-anchor="middle">${m.name.slice(5)}</text>`;
      g += `<text x="${x + (bw - 8) / 2}" y="${H - pad + 26}" fill="#4d4d4a" font-size="9" text-anchor="middle">${m.label}</text>`;
    });
    $("monthChart").innerHTML = g;
    $("monthTable").innerHTML = `<thead><tr><th>${t("range")}</th><th>${t("gz")}</th><th class="num">${t("score")}</th><th>${t("band")}</th><th>${t("themes")}</th><th>${t("opps")}</th><th>${t("cautions")}</th></tr></thead><tbody>` +
      d.map((m) => `<tr><td class="num">${m.name}</td><td><b style="font-family:var(--serif)">${m.label}</b></td>
        <td class="num" style="color:${bandColor(m.score)}">${m.score.toFixed(1)}</td>
        <td><span class="pill ${bandCls(m.score)}">${m.band}</span></td>
        <td class="note">${m.themes.slice(0, 2).join(" · ")}</td>
        <td class="note">${(m.opportunities || []).slice(0, 1).join("") || "—"}</td>
        <td class="note">${(m.cautions || []).slice(0, 1).join("") || "—"}</td></tr>`).join("") + "</tbody>";
  }

  /* ---------- events ---------- */
  function evRow(ev) {
    const row = el("div", "ev-row");
    const kinds = S.kindKeys.map((k, i) => `<option value="${k}"${ev && ev.kind === k ? " selected" : ""}>${S.kinds[LANG][i]}</option>`).join("");
    row.innerHTML = `
      <input type="number" class="ev-year" value="${ev ? ev.year : 2020}" maxlength="4">
      <select class="ev-kind">${kinds}</select>
      <input type="text" class="ev-note" placeholder="${LANG === "zh" ? "发生了什么" : "what happened"}" value="${ev ? (ev.note || "") : ""}">
      <input type="range" class="ev-imp" min="-3" max="3" step="1" value="${ev ? ev.impact : 0}">
      <button class="del">×</button>`;
    row.querySelector(".del").onclick = () => row.remove();
    return row;
  }
  function renderEvents() {
    const list = $("evList");
    if (!list.children.length) { [0, 1, 2].forEach(() => list.appendChild(evRow(null))); }
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
    const res = R.events;
    const box = $("evOut");
    if (!res) { box.innerHTML = `<p class="note">${LANG === "zh" ? "还没有结果。" : "No result yet."}</p>`; return; }
    box.innerHTML = `
      <h2 class="sec">${LANG === "zh" ? "对照结果" : "Back-test result"}</h2>
      <div class="cards">
        <div class="card"><h4>${t("hit")}</h4><div class="big">${res.hitRate}<small>%</small></div></div>
        <div class="card"><h4>${t("corr")}</h4><div class="big">${res.correlation}</div></div>
        <div class="card"><h4>${t("corr2")}</h4><div class="big" style="color:var(--teal)">${res.calibratedCorrelation}</div></div>
      </div>
      <div class="card" style="margin-top:12px"><h4>${t("verdict")}</h4><div class="note">${res.verdict}</div>
        <div class="legend" style="margin-top:6px">${LANG === "zh" ? "校准权重：" : "Fitted weights: "}${Object.keys(res.weights).map((k) => `${k} ${res.weights[k].toFixed(2)}`).join(" · ")}</div></div>
      <div class="card" style="margin-top:12px;overflow-x:auto">
        <table><thead><tr><th>${t("year")}</th><th>${t("gz")}</th><th>${LANG === "zh" ? "类型" : "Type"}</th><th>${LANG === "zh" ? "你的评价" : "Your call"}</th>
        <th class="num">${LANG === "zh" ? "引擎分" : "Model"}</th><th class="num">${LANG === "zh" ? "校准分" : "Fitted"}</th><th>${LANG === "zh" ? "是否吻合" : "Agree"}</th><th>${t("note")}</th></tr></thead><tbody>
        ${res.rows.map((r) => `<tr><td class="num">${r.year}</td><td><b style="font-family:var(--serif)">${r.ganzhi}</b></td>
          <td>${r.kindLabel}</td><td>${r.impact > 0 ? "＋" + r.impact : r.impact}</td>
          <td class="num" style="color:${bandColor(r.predicted)}">${r.predicted.toFixed(1)}</td>
          <td class="num">${r.calibrated.toFixed(1)}</td>
          <td>${r.agree ? `<span class="pill p-hi">${LANG === "zh" ? "吻合" : "yes"}</span>` : `<span class="pill p-low">${LANG === "zh" ? "不符" : "no"}</span>`}</td>
          <td class="note">${r.note || (r.cautions[0] || "")}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
  }

  /* ---------- method ---------- */
  function renderMethod() {
    $("methodBox").innerHTML = LANG === "zh" ? `
      <dl class="kv">
        <dt>历法</dt><dd>太阳视黄经由截断 VSOP87 计算（含章动、光行差、FK5 修正），节气以牛顿迭代求 15° 整数倍时刻；朔望由 Meeus 第 49 章相位算法求得，农历按「无中气置闰」并以日为单位判定——与国标 GB/T 33661-2017 口径一致。</dd>
        <dt>四柱</dt><dd>年柱以立春换年，月柱以十二节换月（五虎遁），日柱以子初/子正换日（可切换），时柱用五鼠遁。支持真太阳时（经度差 + 均时差）。</dd>
        <dt>紫微</dt><dd>寅首五虎遁定宫干、纳音定五行局、起紫微诀（商数宫前走，借数为偶顺行、为奇逆退）安十四主星，辅煞按年干年支与生时定位。四化提供三合派与飞星派两套口径。</dd>
        <dt>评分</dt><dd>八字按天干地支加权（月令 24%）叠加月令旺相休囚死系数，得出五行占比与日主强弱；紫微按三方四正的主星亮度、六吉六煞、生年四化合成宫位分。综合分为六维加权。</dd>
        <dt>校验</dt><dd>历法与四柱：随机 3000 组时刻与 lunar-python 比对，年月日时四柱零误差。紫微：700 例与 iztro 逐星比对，命宫、五行局、宫干、十四主星、十三辅煞全部一致（1 例主星差异源于朔日临界）。浏览器端 JS 与 Python 端逐字段比对，差异仅来自四舍五入。</dd>
        <dt>局限</dt><dd>①未来年份的 ΔT 只能预测，故 2050 年后的节气时刻可能差数十秒；②朔日若恰在午夜前后数秒，农历可能差一天（约三十年一遇）；③评分权重是启发式，请用「经历对照」校准；④本工具不预测具体事件，只描述结构性倾向。</dd>
      </dl>` : `
      <dl class="kv">
        <dt>Calendar</dt><dd>Apparent solar longitude from a truncated VSOP87 series (nutation, aberration, FK5 correction); solar terms solved by Newton iteration on 15° multiples. New moons via Meeus ch.49. The lunisolar calendar uses the no-zhongqi leap rule, decided at day granularity (matching GB/T 33661-2017).</dd>
        <dt>Pillars</dt><dd>Year changes at 立春, month at the 12 節 (五虎遁), day at 23:00 or 00:00 (switchable), hour by 五鼠遁. True solar time = longitude offset + equation of time.</dd>
        <dt>Zi Wei</dt><dd>Palace stems by 五虎遁, bureau by 纳音, 紫微 placed by the classical 起紫微訣 (quotient forward; even borrow forward, odd borrow backward). Sihua available in Sanhe and Feixing variants.</dd>
        <dt>Scoring</dt><dd>BaZi: weighted stems/branches (month command 24%) with seasonal 旺相休囚死 multipliers, giving element shares and day-master strength. Zi Wei: trine-and-opposite with star brightness, auxiliaries, and birth-year sihua. Overall = weighted six dimensions.</dd>
        <dt>Validation</dt><dd>Calendar and pillars: 3,000 random instants vs lunar-python — zero mismatches on all four pillars. Zi Wei: 700 charts vs iztro — life palace, bureau, palace stems, 14 majors and 13 auxiliaries identical (one major-star difference at a new-moon knife edge). Browser JS vs Python: field-by-field parity, differences only from rounding.</dd>
        <dt>Limits</dt><dd>(1) Future ΔT is a prediction, so terms after 2050 may be tens of seconds off. (2) If a new moon falls within seconds of midnight the lunar day may shift by one (~once per 30 years). (3) Weights are heuristic — calibrate with the back-test tab. (4) The tool describes structural tendencies, not specific events.</dd>
      </dl>`;
  }

  /* ---------- cast ---------- */
  function cast() {
    const [y, mo, d] = ($("f-date").value || "1993-06-14").split("-").map(Number);
    const [h, mi] = ($("f-time").value || "12:00").split(":").map(Number);
    const citySel = $("f-city").value;
    const lon = citySel === "custom" ? (+$("f-lon").value || 116.4) : +citySel;
    const opts = {
      name: $("f-name").value || "—", gender: $("f-gender").value,
      y, m: mo, d, h, mi, lon, tz: 8,
      trueSolar: $("f-truesolar").checked,
      ziBoundary: $("f-zistart").checked ? "zi_start" : "zi_mid",
      sihuaSchool: $("f-feixing").checked ? "feixing" : "sanhe",
      leapPolicy: $("f-leapsplit").checked ? "split" : "same",
      focusYear: +$("f-focus").value || new Date().getFullYear()
    };
    try {
      R = ML.buildReading(opts);
    } catch (e) {
      alert("计算失败: " + e.message); throw e;
    }
    renderChart(); renderScore(); drawRadar(); renderYears(); renderMonths();
    if (R.events) renderEventResult();
  }

  function activateFromHash() {
    const map = { chart: "v-chart", score: "v-score", year: "v-year", month: "v-month", event: "v-event", method: "v-method" };
    const keys = Object.keys(map);
    const h = (location.hash || "").replace("#", "");
    const i = keys.indexOf(h);
    if (i < 0) return;
    document.querySelectorAll(".tab").forEach((x, j) => x.classList.toggle("on", j === i));
    document.querySelectorAll(".view").forEach((x) => x.classList.remove("on"));
    $(map[h]).classList.add("on");
    if (h === "score") drawRadar();
  }

  /* ---------- wire ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    paintChrome(); renderEvents(); cast(); renderMethod(); activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
    $("go").onclick = () => { cast(); };
    $("langBtn").onclick = () => {
      LANG = LANG === "zh" ? "en" : "zh";
      document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
      paintChrome();
      if (R) { renderChart(); renderScore(); drawRadar(); renderYears(); renderMonths(); renderEventResult(); }
      renderMethod();
      const list = $("evList"); const evs = collectEvents(); list.innerHTML = "";
      if (evs.length) evs.forEach((e) => list.appendChild(evRow(e))); else renderEvents();
    };
    $("f-city").onchange = () => {
      if ($("f-city").value !== "custom") $("f-lon").value = $("f-city").value;
    };
    $("addEv").onclick = () => $("evList").appendChild(evRow(null));
    $("runEv").onclick = () => {
      const evs = collectEvents();
      if (evs.length < 3) { alert(LANG === "zh" ? "至少填写 3 条经历（影响值不为 0）。" : "Please enter at least 3 events with a non-zero impact."); return; }
      R.events = ML.compareEvents(R.bazi, evs);
      renderEventResult();
    };
  });
})();
