/* 附加层：格局判定（贵贱）、卦象、合盘。
   与 engine.js 分工：engine 算「量」（力量、流通、调候），
   本文件算「质」（成不成格、有无破救）。二者不可互相折算。 */
(function () {
  "use strict";
  const D = window.ML_DATA, ML = window.ML;
  const T = (zh, en) => ({ zh, en });

  const GWX = (() => { const o = {}; D.GAN.split("").forEach((g, i) => { o[g] = D.GAN_WUXING[i]; }); return o; })();
  const POSN = { year: "年", month: "月", day: "日", hour: "时" };
  const GRADES = [[88, "上上格"], [74, "上格"], [60, "中上格"], [44, "中格"], [28, "中下格"], [0, "下格"]];
  const GRADE_EN = { 上上格: "top grade", 上格: "upper grade", 中上格: "upper-middle grade", 中格: "middle grade", 中下格: "lower-middle grade", 下格: "low grade" };
  const LIUHE = D.HE6 || {};
  const SUBST = { 壬: "癸", 癸: "壬", 庚: "辛", 辛: "庚", 甲: "乙", 乙: "甲", 丙: "丁", 丁: "丙", 戊: "己", 己: "戊" };

  function gradeOf(s) { for (const [cut, nm] of GRADES) { if (s >= cut) return nm; } return "下格"; }
  function branchWx(c, wx) {
    return c.pillars.reduce((n, p) => n + p.hidden.filter((h) => GWX[h] === wx).length, 0);
  }
  function clashed(c, pos) {
    const t = c[pos].zhi, ch = D.CHONG[t];
    return c.pillars.some((p) => p.position !== pos && p.zhi === ch);
  }
  function combinedStem(c, stem) {
    const pair = D.GAN_HE[stem];
    if (!pair) return "";
    const tgt = Array.isArray(pair) ? pair[0] : pair;
    const p = c.pillars.find((q) => q.gan === tgt);
    return p ? p.position : "";
  }
  function shaAt(c, name, pos) {
    const v = c.shensha[name];
    if (!v) return false;
    return pos ? v.positions.includes(pos) : true;
  }

  /* ---------------- 八字格 ---------------- */
  function baziGrade(c) {
    const dm = c.dayMaster, dmWx = c.dayMasterWx;
    const yinWx = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmWx);
    const caiWx = D.KE[dmWx];
    const guanWx = Object.keys(D.KE).find((k) => D.KE[k] === dmWx);
    const items = [];
    const add = (kind, name, ok, weight, note) =>
      items.push({ kind, name, ok: !!ok, weight, note });

    // 1. 成格
    add("setup", T("取格有据", "Structure identified"), true, 6,
      T(`月令${c.month.zhi}，${c.structure.basis}`,
        `Month ${c.month.zhi}: ${c.structure.name}`));
    const clean = !!(c.structure.transparent && c.structure.transparent.length);
    add("setup", T("格清气透", "Structure is clean"), clean, 8,
      clean ? T("月令藏干透于天干，格象清而不杂", "The month's hidden stem is transparent — the structure is clean")
        : T("月令藏干未透，格以本气论，力散而象平", "No transparent stem — the structure is read from root qi, flatter and looser"));

    const four = [
      ["官星有气", "Officer has qi", branchWx(c, guanWx) >= 1,
        T(`${guanWx}为官杀，藏于地支 ${branchWx(c, guanWx)} 处`, `${guanWx} as officer, hidden in ${branchWx(c, guanWx)} branches`)],
      ["财星有根", "Wealth is rooted", branchWx(c, caiWx) >= 1,
        T(`${caiWx}为财，藏于地支 ${branchWx(c, caiWx)} 处`, `${caiWx} as wealth, hidden in ${branchWx(c, caiWx)} branches`)],
      ["印星有根", "Resource is rooted", branchWx(c, yinWx) >= 1,
        T(`${yinWx}为印，藏于地支 ${branchWx(c, yinWx)} 处`, `${yinWx} as resource, hidden in ${branchWx(c, yinWx)} branches`)],
      ["日主得地", "Self has ground", c.strength >= 45,
        T(`日主同党 ${c.strength.toFixed(1)}%，${c.strengthLabel}`,
          `Allies ${c.strength.toFixed(1)}% — ${D.I18N.strength[c.strengthLabel] || c.strengthLabel}`)],
    ];
    let fourOk = 0;
    four.forEach(([nm, nmEn, ok, note]) => { if (ok) fourOk++; add("setup", T(nm, nmEn), ok, 5, note); });
    add("setup", T("官财印身俱备", "Officer, wealth, resource, self all rooted"), fourOk === 4, 10,
      T(`四者得 ${fourOk}/4。` + (fourOk === 4 ? "合《子平》上等格之形：官财印身四者皆有强根。" : "尚缺其一，格有偏处，需运来补。"),
        `${fourOk} of 4 rooted. ` + (fourOk === 4 ? "This matches the classical upper-grade form." : "One is missing — the structure is tilted and needs a cycle to fill it.")));

    if (c.strength >= 52) {
      const ok = branchWx(c, caiWx) >= 1 || branchWx(c, guanWx) >= 1;
      add("setup", T("身强能任财官", "Strong self can carry wealth and office"), ok, 7,
        ok ? T("日主偏强而财官有根，担得起", "Strong day master with rooted wealth and office — it can carry them")
          : T("身强而财官无根，力无所用", "Strong but with nothing to carry — force without an outlet"));
    } else {
      const ok = branchWx(c, yinWx) >= 1;
      add("setup", T("身弱得印比扶", "Weak self supported by resource"), ok, 7,
        ok ? T("日主偏弱而印星有根，扶得起", "Weak but rooted resource — support is available")
          : T("身弱而印比无力，格高身弱，福不称格", "Weak and unsupported — the structure outruns the self"));
    }

    const nobles = [["天乙贵人", 5], ["天德贵人", 4], ["月德贵人", 4], ["文昌贵人", 3], ["学堂", 3], ["国印贵人", 3]];
    let noble = 0; const nobleNames = [];
    nobles.forEach(([nm, w]) => { if (shaAt(c, nm)) { noble += w; nobleNames.push(nm); } });
    add("setup", T("命带贵气", "Noble stars present"), noble > 0, Math.min(12, noble),
      nobleNames.length ? T("带 " + nobleNames.join("、") + "，贵气有根", "Carries " + nobleNames.join(", "))
        : T("无贵气星，全凭格局本身", "No noble stars — everything rests on the structure"));

    let chain = 0; const ws = ["木", "火", "土", "金", "水"];
    for (let i = 0; i < 5; i++) {
      if ((c.elementScores[ws[i]] || 0) >= 4 && (c.elementScores[ws[(i + 1) % 5]] || 0) >= 4) chain++;
    }
    add("setup", T("五行流通", "Element flow"), chain >= 3, Math.min(8, chain * 2.2),
      T(`相邻相生链 ${chain} 条，气脉${chain >= 3 ? "贯通" : "偏滞"}`, `${chain} generating chains — ${chain >= 3 ? "circulating" : "sluggish"}`));

    // 2. 破格
    let b0 = 0;
    const guanStems = c.pillars.filter((p) => p.shishenGan === "正官" || p.shishenGan === "七杀");
    guanStems.forEach((p) => {
      const who = combinedStem(c, p.gan);
      if (who) {
        b0 += 7;
        add("break", T(`${POSN[p.position]}干官星被合`, "Officer stem combined away"), true, 7,
          T(`${POSN[p.position]}干${p.gan}（${p.shishenGan}）被${POSN[who]}干合去，官星失用`,
            `The ${POSN[p.position]} stem ${p.gan} is combined away — the officer cannot act`));
      }
    });
    if (!b0 && guanStems.length) {
      add("break", T("官星不受合", "Officer not combined"), false, 0,
        T("官星透干而无人合走，贵气可用", "The officer stands free and can act"));
    }
    if (!b0 && c.pillars.some((p) => p.shishenGan === "伤官") && guanStems.length) {
      add("break", T("伤官见官", "Hurting Officer meets the officer"), true, 5,
        T("伤官与官星并见，贵气受损（《渊海子平》九破之一）", "Hurting Officer and officer together — one of the nine classical breaks"));
    }
    if (D.YANGREN[dm] && c.month.zhi === D.YANGREN[dm]) {
      const ctrl = c.pillars.some((p) => p.shishenGan === "正官" || p.shishenGan === "七杀");
      add("break", T("羊刃无杀制", "Blade uncontrolled"), !ctrl, 5,
        ctrl ? T("刃有官杀制，反成贵格（刃杀两停）", "The blade is controlled — this becomes a noble configuration")
          : T("月令帝旺为刃，局中无官杀制之，刚而易折", "An uncontrolled blade: hard, and brittle"));
    }
    const rivals = c.pillars.filter((p) => (p.shishenGan === "比肩" || p.shishenGan === "劫财") && p.position !== "day");
    if (rivals.length) {
      const hasCai = branchWx(c, caiWx) >= 1;
      add("break", T("比劫争财", "Rivals compete for wealth"), hasCai, 4,
        hasCai ? T(`${rivals.length} 处比劫透干，与日主分争${D.KE[dmWx]}财`, `${rivals.length} rival stems split the wealth with you`)
          : T("有比劫而无财可争，反主朋友助力", "Rivals but no wealth to fight over — they help instead"));
    }
    add("break", T("月令被冲", "Month command clashed"), clashed(c, "month"), 6,
      clashed(c, "month") ? T("月令为格之所系，被冲则根气摇动", "The month command is the root of the structure; a clash shakes it")
        : T("月令无冲，格局安稳", "No clash on the month command"));
    const dhe = combinedStem(c, dm);
    add("break", T("日主被合", "Day master combined"), !!dhe, 4,
      dhe ? T(`日主${dm}被${POSN[dhe]}干合，意志易受牵制`, "The day master is combined — the will is easily pulled")
        : T("日主不受合，自主性强", "The day master stands free"));

    const th = c.tiaohou || {};
    if (th.sequence) {
      const allG = c.pillars.map((p) => p.gan);
      const allH = [].concat(...c.pillars.map((p) => p.hidden));
      const got = [...th.sequence].filter((ch) => allG.includes(ch) || allH.includes(ch));
      const subs = [...th.sequence].filter((ch) => !got.includes(ch) && (allG.includes(SUBST[ch]) || allH.includes(SUBST[ch])));
      if (!got.length && !subs.length) {
        add("break", T("调候全缺", "Climate entirely absent"), true, 5,
          T(`调候取${th.sequence}而局中全无，气候失和`, `The climate stems ${th.sequence} are absent`));
      } else if (!got.length) {
        add("break", T("调候以同类代之", "Climate substituted"), true, 2,
          T(`调候${th.sequence}不见，得${subs.join("")}同类代之，力减而意存`, `${th.sequence} absent, substituted by ${subs.join("")}`));
      }
    }

    // 3. 救应
    c.pillars.filter((p) => p.shishenGan === "食神" || p.shishenGan === "伤官").forEach((p) => {
      const ctrl = c.pillars.filter((q) => (q.shishenGan === "偏印" || q.shishenGan === "正印" || q.shishenGan === "七杀") && q.position !== p.position);
      if (ctrl.length && b0) {
        add("rescue", T(`${POSN[p.position]}干食伤被制`, "The draining stem is controlled"), true, 7,
          T(`${POSN[ctrl[0].position]}干${ctrl[0].gan}（${ctrl[0].shishenGan}）制${p.gan}（${p.shishenGan}），官星得以保全——此为一救`,
            `${ctrl[0].gan} controls ${p.gan}, preserving the officer — one rescue`));
      }
    });
    if (guanStems.length && branchWx(c, caiWx) >= 2) {
      add("rescue", T("财旺生官", "Wealth feeds the officer"), true, 6,
        T(`财${D.KE[dmWx]}藏支 ${branchWx(c, caiWx)} 处，官星虽被合而源不绝`, `Wealth is rooted ${branchWx(c, caiWx)} times — the officer keeps its source`));
    }
    if (rivals.length && branchWx(c, caiWx) >= 1) {
      const bridges = c.pillars.filter((p) => (p.shishenGan === "食神" || p.shishenGan === "伤官") && p.position !== "day");
      if (bridges.length) {
        add("rescue", T("食伤通关化劫", "Output channels the rivals"), true, 5,
          T(`${POSN[bridges[0].position]}干${bridges[0].gan}（${bridges[0].shishenGan}）通关：比劫之气泄于食伤，食伤转而生财，劫不夺财`,
            `${bridges[0].gan} channels rival qi into output, which feeds wealth — no robbery`));
      }
    }
    if (clashed(c, "month")) {
      const mz = c.month.zhi;
      const p = c.pillars.find((q) => q.position !== "month" && LIUHE[q.zhi] === mz);
      if (p) {
        add("rescue", T("冲而得合", "Clash resolved by combination"), true, 5,
          T(`${POSN[p.position]}支${p.zhi}与月令${mz}六合，冲力得解`, `${p.zhi} combines with ${mz} — the clash is dissolved`));
      }
    }
    const ue = ML.usefulElements(c);
    if (ue.avoid.length) {
      const hit = c.pillars.filter((p) => p.hidden.some((h) => ue.avoid.includes(GWX[h])));
      if (hit.length) {
        add("rescue", T("忌神受制", "Hostile element checked"), true, 4,
          T(`忌神${ue.avoid.join("")}落于${POSN[hit[0].position]}支${hit[0].zhi}，其势受制`, `The hostile ${ue.avoid.join("")} lands in ${hit[0].zhi} and is checked`));
      }
    }

    const setup = items.filter((i) => i.kind === "setup" && i.ok).reduce((n, i) => n + i.weight, 0);
    const setupMax = items.filter((i) => i.kind === "setup").reduce((n, i) => n + i.weight, 0) || 1;
    const brk = items.filter((i) => i.kind === "break" && i.ok).reduce((n, i) => n + i.weight, 0);
    const res = items.filter((i) => i.kind === "rescue" && i.ok).reduce((n, i) => n + i.weight, 0);
    const ratio = setup / setupMax;
    // 1.35 倍：《五言独步》「有病方为贵」——有救之破不算真破
    const score = Math.max(6, Math.min(99, 26 + 62 * ratio - brk + res * 1.35));

    return {
      score: Math.round(score * 10) / 10, grade: gradeOf(score),
      setupRatio: Math.round(ratio * 1000) / 1000,
      setupScore: Math.round(setup * 10) / 10, setupMax: Math.round(setupMax * 10) / 10,
      broken: brk, rescued: Math.round(res * 10) / 10,
      items, structure: c.structure.name,
    };
  }

  /* ---------------- 紫微格 ---------------- */
  const LUCKY_AUX = new Set(["左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存", "天马", "三台", "八座", "龙池", "凤阁", "恩光", "天贵"]);
  const BREAKERS = new Set(["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"]);

  function trio(z, p) {
    const by = {}; z.palaces.forEach((q) => { by[q.index] = q; });
    return [-4, 4, 6].map((o) => by[((p.index + o) % 12 + 12) % 12]);
  }
  const majorsOf = (ps) => new Set(ps.flatMap((p) => p.stars.filter((s) => s.kind === "主星").map((s) => s.name)));
  const auxOf = (ps) => new Set(ps.flatMap((p) => p.stars.filter((s) => LUCKY_AUX.has(s.name)).map((s) => s.name)));
  const badOf = (ps) => new Set(ps.flatMap((p) => p.stars.filter((s) => BREAKERS.has(s.name)).map((s) => s.name)));

  function ziweiGrade(z) {
    const ming = z.palaces.find((p) => p.name === "命宫");
    const tr = trio(z, ming), all4 = [ming].concat(tr);
    const mm = majorsOf([ming]), m4 = majorsOf(all4);
    const aux4 = auxOf(all4), bad4 = badOf(all4), badMing = badOf([ming]);
    const ji4 = all4.flatMap((p) => p.stars.filter((s) => s.hua === "忌").map((s) => s.name));
    const found = [];

    const reg = (name, cond, need, note, tier) => {
      if (!cond) return;
      const needN = need.size ? 2 : 1;
      const auxN = need.size ? [...aux4].filter((x) => need.has(x)).length : aux4.size;
      const clean = bad4.size === 0 || (bad4.size === 1 && badMing.size === 0);
      if (auxN >= needN && clean) {
        found.push({ name, status: "成立", tier, note, aux: auxN, bad: [...bad4] });
      } else {
        const why = [];
        if (auxN < needN) why.push("吉星加会不足");
        if (!clean) why.push("见" + [...bad4].join("、") + "，奴欺主");
        if (ji4.length) why.push("化忌同会");
        found.push({ name, status: "有瑕", tier, note: note + "（" + why.join("；") + "）", aux: auxN, bad: [...bad4] });
      }
    };
    const BIG = new Set(["左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存"]);

    reg("极向离明", mm.size === 1 && mm.has("紫微") && ming.branch === "午", new Set(), "紫微居午，如北极向明，领袖之象", "大贵格");
    reg("紫府同宫", mm.has("紫微") && mm.has("天府") && mm.size === 2 && ["寅", "申"].includes(ming.branch), new Set(), "二帝同宫，贵气最重，惟进退步调不一", "大贵格");
    reg("紫府朝垣", m4.has("紫微") && m4.has("天府"), BIG, "紫府合照命垣，主资源聚合，不大贵即当大富", "大贵格");
    reg("君臣庆会", mm.has("紫微"), new Set(["左辅", "右弼", "文昌", "文曲", "天魁", "天钺"]), "紫微为君，辅弼昌曲为臣，主领导与助力兼备", "大贵格");
    const cai = z.palaces.find((p) => p.name === "财帛"), guan = z.palaces.find((p) => p.name === "官禄");
    reg("府相朝垣", majorsOf([cai, guan]).has("天府") && majorsOf([cai, guan]).has("天相"), BIG, "府相夹辅命垣，主富贵双全、人情味厚", "贵格");
    reg("机月同梁", ["天机", "太阴", "天同", "天梁"].every((n) => m4.has(n)), new Set(), "机月同梁作吏人，宜公职、专业、幕僚", "常格");
    reg("日丽中天", mm.size === 1 && mm.has("太阳") && ming.branch === "午", new Set(), "太阳在午，光芒最盛，主贵而显", "贵格");
    reg("日照雷门", mm.size === 1 && mm.has("太阳") && ming.branch === "卯", new Set(), "太阳在卯，旭日东升，主早年得志", "贵格");
    reg("月朗天门", mm.size === 1 && mm.has("太阴") && ming.branch === "亥", new Set(), "太阴在亥，月照天门，主聪慧清贵", "贵格");
    reg("石中隐玉", mm.size === 1 && mm.has("巨门") && ["子", "午"].includes(ming.branch), new Set(), "巨门在子午，先苦后甘，以口才与研究立身", "贵格");
    reg("英星入庙", mm.size === 1 && mm.has("破军") && ["子", "午"].includes(ming.branch), new Set(), "破军在子午入庙，敢破敢立", "常格");
    reg("阳梁昌禄", ["太阳", "天梁", "文昌", "禄存"].every((n) => m4.has(n)), new Set(), "四星会齐，利考试与公职", "贵格");
    reg("巨日同宫", mm.has("巨门") && mm.has("太阳") && ["寅", "申"].includes(ming.branch), new Set(), "巨日同宫，求名易于求利", "贵格");
    const sunP = z.palaces.find((p) => p.stars.some((s) => s.name === "太阳"));
    const moonP = z.palaces.find((p) => p.stars.some((s) => s.name === "太阴"));
    if (sunP && moonP) {
      reg("日月并明", (sunP.branch === "巳" && moonP.branch === "酉") || (sunP.branch === "辰" && moonP.branch === "戌"), new Set(), "日月皆旺，丹墀桂墀，主少年得志", "贵格");
    }
    reg("杀破狼", ["七杀", "破军", "贪狼"].every((n) => m4.has(n)), new Set(), "杀破狼三方会照，一生起伏大，宜开创不宜守成", "变格");
    if (!mm.size) {
      found.push({ name: "命无正曜", status: "成立", tier: "常格", note: "命宫无十四主星，借对宫安星，性格随环境塑造", aux: aux4.size, bad: [...bad4] });
    }

    const tierW = { 大贵格: 96, 贵格: 86, 常格: 70, 变格: 62 };
    let base = 56;
    if (found.length) {
      base = Math.max.apply(null, found.map((f) => tierW[f.tier] || 70));
      const best = found.slice().sort((a, b) => (tierW[b.tier] || 70) - (tierW[a.tier] || 70)
        - (b.status === "成立" ? 0 : 9) + (a.status === "成立" ? 0 : 9))[0];
      if (best.status !== "成立") base -= 9 + 2.5 * best.bad.length;
    }
    let bonus = 0;
    const BR = { 庙: 3, 旺: 2.2, 得地: 1.2, 利: 0.6, 平: 0, 不得地: -1.2, 陷: -2.4 };
    ming.stars.forEach((s) => {
      if (s.kind === "主星") bonus += BR[s.brightness] || 0;
      else if (LUCKY_AUX.has(s.name)) bonus += 1.2;
      else if (BREAKERS.has(s.name)) bonus -= 2.2;
      if (s.hua === "禄") bonus += 2;
      else if (s.hua === "权") bonus += 1.5;
      else if (s.hua === "科") bonus += 1.5;
      else if (s.hua === "忌") bonus -= 2.6;
    });
    const score = Math.max(8, Math.min(99, base + Math.max(-8, Math.min(8, bonus))));
    return {
      score: Math.round(score * 10) / 10, grade: gradeOf(score),
      patterns: found, mingAux: [...aux4], mingBad: [...bad4], ji: ji4,
    };
  }

  function combinedGrade(b, z, w) {
    const bw = w === undefined ? 0.55 : w;
    const score = bw * b.score + (1 - bw) * z.score;
    const grade = gradeOf(score);
    return {
      score: Math.round(score * 10) / 10, grade, gradeEn: GRADE_EN[grade],
      bazi: b, ziwei: z,
      basis: `八字格 ${b.score.toFixed(1)}（${b.grade}，成格度 ${(b.setupRatio * 100).toFixed(0)}%，破 ${b.broken} 分、救 ${b.rescued} 分）· 紫微格 ${z.score.toFixed(1)}（${z.grade}）`,
    };
  }

  /* ---------------- 梅花易数 ---------------- */
  const TRI = {};
  D.GUA.trigrams.forEach((t) => { TRI[t[0]] = t; });
  const GUA_MAP = {};
  D.GUA.rows.forEach((r) => { GUA_MAP[r[0] + "|" + r[1]] = r; });
  const WX_SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
  const WX_KE = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

  function castGua(yearBranchNum, lunarMonth, lunarDay, hourBranchNum) {
    const s = yearBranchNum + lunarMonth + lunarDay;
    const upN = s % 8 || 8;
    const loN = (s + hourBranchNum) % 8 || 8;
    const move = (s + hourBranchNum) % 6 || 6;
    const names = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"];
    const up = names[(upN - 1) % 8], lo = names[(loN - 1) % 8];
    const g = GUA_MAP[up + "|" + lo];

    const upLine = TRI[up][2].slice(), loLine = TRI[lo][2].slice();
    const lines = upLine.slice().reverse().concat(loLine.slice().reverse());
    const flipped = lines.slice();
    flipped[move - 1] = flipped[move - 1] ? 0 : 1;

    const huLo = [flipped[3], flipped[2], flipped[1]];
    const huUp = [flipped[4], flipped[3], flipped[2]];
    const findTri = (arr) => D.GUA.trigrams.find((t) => t[2].join("") === arr.join(""))[0];
    const hu = GUA_MAP[findTri(huUp) + "|" + findTri(huLo)];

    const bUp = findTri(flipped.slice(3).reverse());
    const bLo = findTri(flipped.slice(0, 3).reverse());
    const bian = GUA_MAP[bUp + "|" + bLo];

    let ti, yong;
    if (move <= 3) { ti = up; yong = lo; } else { ti = lo; yong = up; }
    const tiWx = TRI[ti][5], yongWx = TRI[yong][5];
    let rel, relZh, relEn, relTone;
    if (tiWx === yongWx) { rel = "比和"; relTone = "good"; relZh = "体用比和，事情顺遂、彼此相当"; relEn = "Self and matter are equal — smooth, neither side dominates"; }
    else if (WX_SHENG[yongWx] === tiWx) { rel = "用生体"; relTone = "good"; relZh = "用生体，外来之力助我，大吉"; relEn = "The matter generates you — outside help arrives"; }
    else if (WX_SHENG[tiWx] === yongWx) { rel = "体生用"; relTone = "mid"; relZh = "体生用，我方付出多、耗气，事成而我损"; relEn = "You generate the matter — it succeeds at your expense"; }
    else if (WX_KE[tiWx] === yongWx) { rel = "体克用"; relTone = "good"; relZh = "体克用，我能制事，可为但需用力"; relEn = "You control the matter — doable, with effort"; }
    else { rel = "用克体"; relTone = "bad"; relZh = "用克体，事来克我，阻力大，宜退"; relEn = "The matter controls you — strong resistance, better to withdraw"; }

    return {
      upper: up, lower: lo, name: g[2], nameEn: g[5], text: g[3], tone: g[4],
      trace: TRI[up][1] + TRI[lo][1],
      lines, moving: move, flipped,
      mutual: hu[2], mutualText: hu[3], result: bian[2], resultText: bian[3], resultTone: bian[4],
      ti, yong, tiWx, yongWx, rel, relZh, relEn, relTone,
      numbers: { upper: upN, lower: loN, moving: move, sum: s, sumHour: s + hourBranchNum },
    };
  }

  /* ---------------- 合盘 ---------------- */
  function synastry(chartA, chartB, zA, zB, relation) {
    const cfg = D.SYNASTRY[relation] || D.SYNASTRY.couple;
    const w = cfg.weights;
    const items = [];

    // 日主
    const ga = chartA.dayMaster, gb = chartB.dayMaster;
    const wa = GWX[ga], wb = GWX[gb];
    let dmS = 66, dmNote;
    if (D.GAN_HE[ga] && (Array.isArray(D.GAN_HE[ga]) ? D.GAN_HE[ga][0] : D.GAN_HE[ga]) === gb) {
      dmS = 88; dmNote = `${ga}与${gb}天干五合，天生有默契，彼此容易被对方吸引或认同`;
    } else if (wa === wb) {
      dmS = 68; dmNote = `同为${wa}，性质相近，容易理解彼此，但也容易同进同退、缺乏互补`;
    } else if (D.SHENG[wa] === wb) {
      dmS = 76; dmNote = `${ga}${wa}生${gb}${wb}：前者付出、后者受益，长期看前者易疲`;
    } else if (D.SHENG[wb] === wa) {
      dmS = 76; dmNote = `${gb}${wb}生${ga}${wa}：后者的五行滋养前者，前者是受益方`;
    } else if (D.KE[wa] === wb) {
      dmS = 54; dmNote = `${ga}${wa}克${gb}${wb}：前者天然占主导，后者易感到压迫`;
    } else {
      dmS = 54; dmNote = `${gb}${wb}克${ga}${wa}：后者对前者有克制力，关系较紧绷`;
    }
    items.push({ key: "dayMaster", zh: "日主互动", en: "Day masters", score: dmS, notes: [{ note: dmNote }] });

    // 夫妻宫
    const za = chartA.day.zhi, zb = chartB.day.zhi;
    let spS = 66, spNote = `日支${za}与${zb}无合无冲，属中性：关系走向更多取决于双方的选择`;
    if (LIUHE[za] === zb) { spS = 90; spNote = `日支${za}与${zb}六合，是最直接的亲密信号：生活习惯容易磨合`; }
    else if (D.CHONG[za] === zb) { spS = 42; spNote = `日支${za}与${zb}相冲：相处节奏差异大，容易在细节上反复摩擦。冲不必然分，但需要明确的边界`; }
    else if (D.SANHE.some((g) => g.slice(0, 3).includes(za) && g.slice(0, 3).includes(zb))) {
      spS = 82; spNote = `日支${za}与${zb}同属一个三合局，有共同的目标或圈子把两人绑在一起`;
    } else if (D.HAI6[za] === zb) { spS = 58; spNote = `日支${za}与${zb}相害：暗里较劲，表面无事反而更累`; }
    items.push({ key: "spouse", zh: "夫妻宫（日支）", en: "Day branches", score: spS, notes: [{ note: spNote }] });

    // 五行
    const ea = chartA.elementScores, eb = chartB.elementScores;
    const gapA = Object.keys(ea).filter((k) => ea[k] < 8);
    const gapB = Object.keys(eb).filter((k) => eb[k] < 8);
    const fillA = gapA.filter((k) => (eb[k] || 0) >= 20);
    const fillB = gapB.filter((k) => (ea[k] || 0) >= 20);
    const elN = fillA.length + fillB.length;
    const elS = elN >= 3 ? 88 : elN === 2 ? 78 : elN === 1 ? 68 : 54;
    const elNotes = [];
    if (fillA.length) elNotes.push({ note: `前者缺${gapA.join("") || "—"}，后者正好补上${fillA.join("")}——这是最实在的互补` });
    if (fillB.length) elNotes.push({ note: `后者缺${gapB.join("") || "—"}，前者正好补上${fillB.join("")}` });
    if (!elN) elNotes.push({ note: "两人的五行短板高度重合，谁也补不了谁；遇到同类困境时容易一起陷进去" });
    items.push({ key: "elements", zh: "五行互补", en: "Element fit", score: elS, notes: elNotes });

    // 用神
    const ua = ML.usefulElements(chartA), ub = ML.usefulElements(chartB);
    const hitAB = ua.favor.filter((k) => (eb[k] || 0) >= 18);
    const hitBA = ub.favor.filter((k) => (ea[k] || 0) >= 18);
    const usN = hitAB.length + hitBA.length;
    const usS = Math.min(92, 58 + usN * 9);
    const usNotes = [];
    if (hitAB.length) usNotes.push({ note: `前者的用神是${ua.favor.join("")}，后者命中${hitAB.join("")}旺——后者对前者是「补药」` });
    if (hitBA.length) usNotes.push({ note: `后者的用神是${ub.favor.join("")}，前者命中${hitBA.join("")}旺——前者对后者是「补药」` });
    if (!usN) usNotes.push({ note: "彼此的用神都不在对方命里旺，这段关系提供的是陪伴而非助力" });
    items.push({ key: "useful", zh: "用神互济", en: "Useful god", score: usS, notes: usNotes });

    // 紫微
    let zwS = 64, zwNotes = [];
    if (zA && zB) {
      if (LIUHE[zA.mingBranch] === zB.mingBranch) { zwS = 84; zwNotes.push({ note: `两盘命宫${zA.mingBranch}与${zB.mingBranch}六合，气场相接，初见即觉投缘` }); }
      else if (D.CHONG[zA.mingBranch] === zB.mingBranch) { zwS = 50; zwNotes.push({ note: `两盘命宫${zA.mingBranch}与${zB.mingBranch}相冲，行事风格对立；各自独立反而比紧密协作更顺` }); }
      else zwNotes.push({ note: `两盘命宫${zA.mingBranch}与${zB.mingBranch}无直接合冲，关系质量取决于各自的盘` });
    }
    items.push({ key: "ziwei", zh: "紫微气场", en: "Zi Wei field", score: zwS, notes: zwNotes });

    // 关系星
    const maleA = ["male", "男", "m"].includes(chartA.gender);
    let ssS, ssNote;
    if (["couple", "lover"].includes(relation)) {
      if (maleA) {
        const wx = D.KE[chartA.dayMasterWx], have = eb[wx] || 0;
        ssS = Math.min(90, 54 + have * 1.3);
        ssNote = `男命以${wx}为财（妻星），对方命中${wx}占 ${have.toFixed(1)}%` + (have >= 18 ? "，妻星得位" : "，妻星偏弱，需主动经营");
      } else {
        const wx = Object.keys(D.KE).find((k) => D.KE[k] === chartA.dayMasterWx), have = eb[wx] || 0;
        ssS = Math.min(90, 54 + have * 1.3);
        ssNote = `女命以${wx}为官（夫星），对方命中${wx}占 ${have.toFixed(1)}%` + (have >= 18 ? "，夫星得力" : "，夫星偏弱，宜共同成长");
      }
    } else if (relation === "partner") {
      const wx = D.KE[chartA.dayMasterWx], have = eb[wx] || 0;
      ssS = Math.min(90, 54 + have * 1.3);
      ssNote = `前者的财星是${wx}，后者命中占 ${have.toFixed(1)}%；财星旺者宜掌钱，弱者宜掌事`;
    } else if (relation === "parent") {
      const wx = Object.keys(D.SHENG).find((k) => D.SHENG[k] === chartA.dayMasterWx), have = eb[wx] || 0;
      ssS = Math.min(90, 54 + have * 1.3);
      ssNote = `前者以${wx}为印（庇荫），后者命中占 ${have.toFixed(1)}%；印旺则教养偏保护，印弱则偏放手`;
    } else {
      const wx = Object.keys(D.KE).find((k) => D.KE[k] === chartA.dayMasterWx), have = eb[wx] || 0;
      const gap = chartA.strength - chartB.strength;
      ssS = Math.min(92, 56 + have * 1.1 + (gap > 0 ? 6 : -4));
      ssNote = `前者日主强度 ${chartA.strength.toFixed(0)}%，后者 ${chartB.strength.toFixed(0)}%，差 ${Math.abs(gap).toFixed(0)} 个百分点；`
        + (Math.abs(gap) >= 10 ? "一方明显能任事，权威关系较自然" : "强弱相近，谁说了算容易僵持");
    }
    items.push({ key: "shishen", zh: "关系星", en: "Relationship star", score: ssS, notes: [{ note: ssNote }] });

    let total = 0;
    items.forEach((it) => { total += it.score * (w[it.key] || 0); });
    const band = total >= 82 ? "上等" : total >= 70 ? "中上" : total >= 58 ? "中等" : total >= 46 ? "中下" : "下等";
    const bandEn = { 上等: "excellent", 中上: "good", 中等: "workable", 中下: "strained", 下等: "difficult" }[band];

    return {
      relation, relationZh: cfg.zh, relationEn: cfg.en,
      score: Math.round(total * 10) / 10, band, bandEn, items, weights: w,
      note: cfg.note, noteEn: cfg.noteEn,
      a: { four: chartA.pillars.map((p) => p.gan + p.zhi).join(" "), dm: ga, dmWx: wa, strength: +chartA.strength.toFixed(1) },
      b: { four: chartB.pillars.map((p) => p.gan + p.zhi).join(" "), dm: gb, dmWx: wb, strength: +chartB.strength.toFixed(1) },
    };
  }

  Object.assign(window.ML, {
    gradeOf, GRADE_EN, baziGrade, ziweiGrade, combinedGrade, castGua, synastry,
  });

  /* 把格位挂进 buildReading 的返回值：格位（贵贱）与强度（力量）并列输出 */
  const _buildReading = window.ML.buildReading;
  window.ML.buildReading = function (o) {
    const r = _buildReading(o);
    try {
      r.grade = combinedGrade(baziGrade(r.bazi), ziweiGrade(r.ziwei));
      r.scores.grade = r.grade;
    } catch (e) {
      console.error("grade", e);
    }
    return r;
  };
  const _yearPeriod = window.ML.yearPeriod;
  const _monthPeriods = window.ML.monthPeriods;
  window.ML.__version = "2026-10-18c";
})();
