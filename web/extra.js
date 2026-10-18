/* 附加层：格局判定（贵贱）、卦象、合盘。
   与 engine.js 分工：engine 算「量」（力量、流通、调候），
   本文件算「质」（成不成格、有无破救）。二者不可互相折算。 */
(function () {
  "use strict";
  const D = window.ML_DATA, ML = window.ML;
  const T = (zh, en) => ({ zh, en });

  const GWX = (() => { const o = {}; D.GAN.split("").forEach((g, i) => { o[g] = D.GAN_WUXING[i]; }); return o; })();
  const POSN = { year: "年", month: "月", day: "日", hour: "时" };
  /* 英文串里的中文变量必须先就地换成英文/拼音：T(zh, en) 的两个参数是各自独立
     的成品句子，en 里夹一个汉字就是漏网。 */
  const GAN_PY = { 甲: "Jia", 乙: "Yi", 丙: "Bing", 丁: "Ding", 戊: "Wu",
    己: "Ji", 庚: "Geng", 辛: "Xin", 壬: "Ren", 癸: "Gui" };
  const ZHI_PY = { 子: "Zi", 丑: "Chou", 寅: "Yin", 卯: "Mao", 辰: "Chen", 巳: "Si",
    午: "Wu", 未: "Wei", 申: "Shen", 酉: "You", 戌: "Xu", 亥: "Hai" };
  const gz = (s) => !s ? s : [...s].map((ch) => GAN_PY[ch] || ZHI_PY[ch] || ch).join(" ");
  const wxe = (w) => (D.I18N.wx && D.I18N.wx[w]) || w;
  const STRU_EXTRA = { 比肩格: "Parallel structure", 劫财格: "Rob Wealth structure",
    比劫格: "Rivals structure", 杂气格: "Mixed Qi structure",
    "从格（从势/从财杀）": "Following structure" };
  const stru = (n) => (D.I18N.structure && D.I18N.structure[n]) || STRU_EXTRA[n] || n;
  const GRADE_EN = { 上上格: "top grade", 上格: "upper grade", 中上格: "upper-middle grade", 中格: "middle grade", 中下格: "lower-middle grade", 下格: "low grade" };
  const LIUHE = D.HE6 || {};
  const SUBST = { 壬: "癸", 癸: "壬", 庚: "辛", 辛: "庚", 甲: "乙", 乙: "甲", 丙: "丁", 丁: "丙", 戊: "己", 己: "戊" };

  /* 分档按「百分位」而不是「分数」。
     旧版把切点硬写成 88/74/60/44/28，但没人核对过分数本身的分布：实测随机盘
     八字格均值 75.3（sd 11.0）、紫微格 69.7（sd 14.8），于是「上格」吃掉四成，
     「中上格」成了众数——分档词全部失去意义。现在与 engine 的 tierOf 共用一套
     百分位切点（97/88/72/40/15），「上格」在任何地方都等于「前 12%」。 */
  function erfJs(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function pctFrom(stats, v) {
    const mu = stats ? stats[0] : 60, sd = stats ? (stats[1] || 1) : 8;
    return Math.round((0.5 + 0.5 * erfJs(((v - mu) / sd) / Math.SQRT2)) * 1000) / 10;
  }
  function gradePct(score, kind) {
    const g = (D.PERCENTILES && D.PERCENTILES.gradeStats) || {};
    return pctFrom(g[kind || "bazi"] || [60, 10], score);
  }
  function gradeOf(score, kind) {
    const tier = ML.tierOf ? ML.tierOf : (p) => (p >= 88 ? "上格" : p >= 40 ? "中格" : "中下格");
    return tier(gradePct(score, kind));
  }
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
        `Month ${gz(c.month.zhi)}: ${stru(c.structure.name)}`));
    const clean = !!(c.structure.transparent && c.structure.transparent.length);
    add("setup", T("格清气透", "Structure is clean"), clean, 8,
      clean ? T("月令藏干透于天干，格象清而不杂", "The month's hidden stem is transparent — the structure is clean")
        : T("月令藏干未透，格以本气论，力散而象平", "No transparent stem — the structure is read from root qi, flatter and looser"));

    const four = [
      ["官星有气", "Officer has qi", branchWx(c, guanWx) >= 1,
        T(`${guanWx}为官杀，藏于地支 ${branchWx(c, guanWx)} 处`, `${wxe(guanWx)} as officer, hidden in ${branchWx(c, guanWx)} branch(es)`)],
      ["财星有根", "Wealth is rooted", branchWx(c, caiWx) >= 1,
        T(`${caiWx}为财，藏于地支 ${branchWx(c, caiWx)} 处`, `${wxe(caiWx)} as wealth, hidden in ${branchWx(c, caiWx)} branch(es)`)],
      ["印星有根", "Resource is rooted", branchWx(c, yinWx) >= 1,
        T(`${yinWx}为印，藏于地支 ${branchWx(c, yinWx)} 处`, `${wxe(yinWx)} as resource, hidden in ${branchWx(c, yinWx)} branch(es)`)],
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
      nobleNames.length ? T("带 " + nobleNames.join("、") + "，贵气有根", "Carries " + nobleNames.map((n) => (D.I18N.shensha && D.I18N.shensha[n]) || n).join(", "))
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
          T(`调候取${th.sequence}而局中全无，气候失和`, `The climate stems ${gz(th.sequence)} are absent`));
      } else if (!got.length) {
        add("break", T("调候以同类代之", "Climate substituted"), true, 2,
          T(`调候${th.sequence}不见，得${subs.join("")}同类代之，力减而意存`, `${gz(th.sequence)} absent, substituted by ${gz(subs.join(""))}`));
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
    // 与整体评分同一口径（扶抑），不用流年的格局用神，否则格位分会漂
    const ue = ML.strengthUseful(c);
    if (ue.avoid.length) {
      // 忌神受制 = 有一个**不属于忌神**的五行在克它，而且那个五行有力量。
      // 旧版查的是「忌神出现在某个地支里」——忌神落在本气之地叫「得地」，
      // 是加凶不是减凶。丙火 77% 落在午，被当成「受制」加了 4 分。
      const es0 = c.elementScores;
      const main = ue.avoid.slice().sort((a, b) => (es0[b] || 0) - (es0[a] || 0))[0];
      const ctrl = Object.keys(D.KE).find((k) => D.KE[k] === main);
      if (!ue.avoid.includes(ctrl) && (es0[ctrl] || 0) >= 5) {
        add("rescue", T("忌神受制", "Hostile element checked"), true, 4,
          T(`忌神${main}（占 ${es0[main].toFixed(1)}%）得${ctrl}克制（占 ${es0[ctrl].toFixed(1)}%），其势有制`,
            `The hostile ${wxe(main)} (${es0[main].toFixed(1)}%) is checked by ${wxe(ctrl)} (${es0[ctrl].toFixed(1)}%)`));
      } else {
        add("rescue", T("忌神无制", "Hostile element unchecked"), false, 4,
          T(`忌神${main}（占 ${es0[main].toFixed(1)}%）不见有力之克，其势肆行`,
            `The hostile ${wxe(main)} (${es0[main].toFixed(1)}%) has nothing to check it`));
      }
    }

    // 格有变通（《子平真诠·论用神变化》）：官星被合而去，若食伤透干、财又有根，
    // 格不废，只是换了条路——食神生财照样是月刃格的成格路径。
    if (b0) {
      const bridges = c.pillars.filter((p) => (p.shishenGan === "食神" || p.shishenGan === "伤官") && p.position !== "day");
      const caiOk = branchWx(c, caiWx) >= 1;
      add("setup", T("格有变通", "Structure rerouted"), !!(bridges.length && caiOk), 7,
        bridges.length && caiOk
          ? T(`官星被合，改以${bridges[0].shishenGan}${bridges[0].gan}生财为用，格转而不断（用神变化）`,
              `The officer is combined away, so ${bridges[0].gan} output feeds wealth instead — the structure bends but does not break`)
          : (bridges.length
            ? T("官星被合，食伤虽见而财无根，转亦无力", "The officer is gone and the wealth has no root — rerouting does not help")
            : T("官星被合而食伤不见，无路可转", "The officer is gone with no output to take over")));
    } else {
      add("setup", T("格有变通", "Structure rerouted"), false, 7,
        T("官星未损，不必变通", "The officer is intact — nothing to reroute"));
    }

    const setup = items.filter((i) => i.kind === "setup" && i.ok).reduce((n, i) => n + i.weight, 0);
    const setupMax = items.filter((i) => i.kind === "setup").reduce((n, i) => n + i.weight, 0) || 1;
    const brk = items.filter((i) => i.kind === "break" && i.ok).reduce((n, i) => n + i.weight, 0);
    const res = items.filter((i) => i.kind === "rescue" && i.ok).reduce((n, i) => n + i.weight, 0);
    const ratio = setup / setupMax;
    // 1.35 倍：《五言独步》「有病方为贵」——有救之破不算真破
    const score = Math.max(6, Math.min(99, 26 + 62 * ratio - brk + res * 1.35));

    return {
      score: Math.round(score * 10) / 10, grade: gradeOf(score, "bazi"),
      percentile: gradePct(score, "bazi"),
      gradeEn: GRADE_EN[gradeOf(score, "bazi")],
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

    const reg = (name, cond, need, note, tier, nameEn, noteEn) => {
      if (!cond) return;
      const needN = need.size ? 2 : 1;
      const auxN = need.size ? [...aux4].filter((x) => need.has(x)).length : aux4.size;
      const clean = bad4.size === 0 || (bad4.size === 1 && badMing.size === 0);
      const star = (n) => (D.I18N.star && D.I18N.star[n]) || n;
      if (auxN >= needN && clean) {
        found.push({ name, nameEn: nameEn || name, status: "成立", statusEn: "holds",
          tier, note, noteEn: noteEn || note, aux: auxN, bad: [...bad4] });
      } else {
        const why = [], whyEn = [];
        if (auxN < needN) { why.push("吉星加会不足"); whyEn.push("too few auxiliary stars"); }
        if (!clean) {
          why.push("见" + [...bad4].join("、") + "，奴欺主");
          whyEn.push("with " + [...bad4].map(star).join(", ") + " — the servant overpowers the master");
        }
        if (ji4.length) { why.push("化忌同会"); whyEn.push("an obstacle transformation in the same trine"); }
        found.push({ name, nameEn: nameEn || name, status: "有瑕", statusEn: "flawed", tier,
          note: note + "（" + why.join("；") + "）",
          noteEn: (noteEn || note) + " (" + whyEn.join("; ") + ")",
          aux: auxN, bad: [...bad4] });
      }
    };
    const BIG = new Set(["左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存"]);

    reg("极向离明", mm.size === 1 && mm.has("紫微") && ming.branch === "午", new Set(), "紫微居午，如北极向明，领袖之象", "大贵格",
      "Pole Facing the Light", "Zi Wei in Wu: the pole star facing the light — a leader's form");
    reg("紫府同宫", mm.has("紫微") && mm.has("天府") && mm.size === 2 && ["寅", "申"].includes(ming.branch), new Set(), "二帝同宫，贵气最重，惟进退步调不一", "大贵格",
      "Zi Wei and Tian Fu Together", "Two emperors in one palace — the heaviest nobility, though they move at different paces");
    reg("紫府朝垣", m4.has("紫微") && m4.has("天府"), BIG, "紫府合照命垣，主资源聚合，不大贵即当大富", "大贵格",
      "Zi Wei and Tian Fu in Trine", "The two emperors shine on the life palace: resources gather — either high rank or great wealth");
    reg("君臣庆会", mm.has("紫微"), new Set(["左辅", "右弼", "文昌", "文曲", "天魁", "天钺"]), "紫微为君，辅弼昌曲为臣，主领导与助力兼备", "大贵格",
      "Ruler and Ministers Meet", "Zi Wei as ruler, the auxiliaries as ministers — leadership with support");
    const cai = z.palaces.find((p) => p.name === "财帛"), guan = z.palaces.find((p) => p.name === "官禄");
    reg("府相朝垣", majorsOf([cai, guan]).has("天府") && majorsOf([cai, guan]).has("天相"), BIG, "府相夹辅命垣，主富贵双全、人情味厚", "贵格",
      "Tian Fu and Tian Xiang in Trine", "Fu and Xiang flank the life palace: wealth with rank, and warmth with people");
    reg("机月同梁", ["天机", "太阴", "天同", "天梁"].every((n) => m4.has(n)), new Set(), "机月同梁作吏人，宜公职、专业、幕僚", "常格",
      "Ji, Yue, Tong, Liang", "The classic clerk form: public office, the professions, staff work");
    reg("日丽中天", mm.size === 1 && mm.has("太阳") && ming.branch === "午", new Set(), "太阳在午，光芒最盛，主贵而显", "贵格",
      "Sun at Midheaven", "The sun in Wu at full brilliance — prominent and noble");
    reg("日照雷门", mm.size === 1 && mm.has("太阳") && ming.branch === "卯", new Set(), "太阳在卯，旭日东升，主早年得志", "贵格",
      "Sun Shining on the Thunder Gate", "The sun in Mao, rising: early success");
    reg("月朗天门", mm.size === 1 && mm.has("太阴") && ming.branch === "亥", new Set(), "太阴在亥，月照天门，主聪慧清贵", "贵格",
      "Moon Bright at the Heavenly Gate", "Tai Yin in Hai: clear intelligence with quiet nobility");
    reg("石中隐玉", mm.size === 1 && mm.has("巨门") && ["子", "午"].includes(ming.branch), new Set(), "巨门在子午，先苦后甘，以口才与研究立身", "贵格",
      "Jade Hidden in Stone", "Ju Men in Zi or Wu: bitter first, sweet later; lives by speech and research");
    reg("英星入庙", mm.size === 1 && mm.has("破军") && ["子", "午"].includes(ming.branch), new Set(), "破军在子午入庙，敢破敢立", "常格",
      "Hero Star Enshrined", "Po Jun in Zi or Wu at its peak: breaks and builds, decisive");
    reg("阳梁昌禄", ["太阳", "天梁", "文昌", "禄存"].every((n) => m4.has(n)), new Set(), "四星会齐，利考试与公职", "贵格",
      "Sun, Liang, Chang, Lu", "All four together: favourable for examinations and public office");
    reg("巨日同宫", mm.has("巨门") && mm.has("太阳") && ["寅", "申"].includes(ming.branch), new Set(), "巨日同宫，求名易于求利", "贵格",
      "Ju Men and Sun Together", "Fame comes more easily than money");
    const sunP = z.palaces.find((p) => p.stars.some((s) => s.name === "太阳"));
    const moonP = z.palaces.find((p) => p.stars.some((s) => s.name === "太阴"));
    if (sunP && moonP) {
      reg("日月并明", (sunP.branch === "巳" && moonP.branch === "酉") || (sunP.branch === "辰" && moonP.branch === "戌"), new Set(), "日月皆旺，丹墀桂墀，主少年得志", "贵格",
        "Sun and Moon Both Bright", "Both luminaries strong: early success and public notice");
    }
    reg("杀破狼", ["七杀", "破军", "贪狼"].every((n) => m4.has(n)), new Set(), "杀破狼三方会照，一生起伏大，宜开创不宜守成", "变格",
      "Sha Po Lang", "Seven Killings, Breaker and Greedy Wolf in trine: a life of swings — build, do not conserve");
    if (!mm.size) {
      found.push({ name: "命无正曜", nameEn: "No Major Star in the Life Palace",
        status: "成立", statusEn: "holds", tier: "常格",
        note: "命宫无十四主星，借对宫安星，性格随环境塑造",
        noteEn: "The life palace holds no major star; it borrows from the opposite palace, so character is shaped by circumstance",
        aux: aux4.size, bad: [...bad4] });
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
      score: Math.round(score * 10) / 10, grade: gradeOf(score, "ziwei"),
      percentile: gradePct(score, "ziwei"),
      gradeEn: GRADE_EN[gradeOf(score, "ziwei")],
      // 展示用全表（30 条，含未成立）；格位分仍按本文件的 found 算。
      // 两套并存是历史包袱：这里判「格位」，引擎判「贵气」，口径不同不能混。
      patterns: (typeof window !== "undefined" && window.ML && window.ML.detectPatterns)
        ? window.ML.detectPatterns(z) : found,
      mingAux: [...aux4], mingBad: [...bad4], ji: ji4,
    };
  }

  function combinedGrade(b, z, w) {
    const bw = w === undefined ? 0.55 : w;
    const score = bw * b.score + (1 - bw) * z.score;
    // 两项不能直接按分数加权：八字格均值 75.3、紫微格 69.7，同一把尺子各有各的零点，
    // 直接平均会让八字悄悄多占份额。先各自换成百分位，再加权。
    const pct = Math.round((bw * gradePct(b.score, "bazi")
      + (1 - bw) * gradePct(z.score, "ziwei")) * 10) / 10;
    const tier = ML.tierOf ? ML.tierOf : (p) => (p >= 88 ? "上格" : p >= 40 ? "中格" : "中下格");
    const grade = tier(pct);
    return {
      score: Math.round(score * 10) / 10, grade, percentile: pct, gradeEn: GRADE_EN[grade],
      bazi: b, ziwei: z,
      basis: `八字格 ${b.score.toFixed(1)}（${b.grade}，胜过 ${b.percentile.toFixed(0)}% 的随机命盘，成格度 ${(b.setupRatio * 100).toFixed(0)}%，破 ${b.broken} 分、救 ${b.rescued} 分）· 紫微格 ${z.score.toFixed(1)}（${z.grade}，胜过 ${z.percentile.toFixed(0)}%）· 合计胜过 ${pct.toFixed(0)}%`,
      basisEn: `BaZi ${b.score.toFixed(1)} (${GRADE_EN[b.grade]}, ahead of ${b.percentile.toFixed(0)}% of charts, setup ${(b.setupRatio * 100).toFixed(0)}%, breaks −${b.broken}, rescues +${b.rescued}) · Zi Wei ${z.score.toFixed(1)} (${GRADE_EN[z.grade]}, ahead of ${z.percentile.toFixed(0)}%) · overall ahead of ${pct.toFixed(0)}%`,
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
    // 六爻从初到上：下卦三爻在前，上卦三爻在后
    const lines = loLine.slice().reverse().concat(upLine.slice().reverse());
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

    const NM = D.GUA.names || {};
    return {
      upper: up, lower: lo, name: g[2], nameEn: NM[g[2]] || g[2],
      text: g[3], textEn: g[5], tone: g[4],
      trace: TRI[up][1] + TRI[lo][1],
      lines, moving: move, flipped,
      mutual: hu[2], mutualEn: NM[hu[2]] || hu[2], mutualText: hu[3],
      result: bian[2], resultEn: NM[bian[2]] || bian[2], resultText: bian[3], resultTone: bian[4],
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
