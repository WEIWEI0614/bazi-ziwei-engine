/* mingli-engine browser core — a faithful port of the Python reference.
 * Every astronomical constant and lookup table comes from data.js, which is
 * generated from the Python modules, so the two implementations cannot drift.
 */
(function () {
  "use strict";
  const D = window.ML_DATA;
  const GAN = [...D.GAN], ZHI = [...D.ZHI];
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const gi = (g) => GAN.indexOf(g), zi = (z) => ZHI.indexOf(z);
  const mod = (a, n) => ((a % n) + n) % n;

  /* ---------------- astronomy ---------------- */
  function toJD(y, mo, d, h = 0, mi = 0, s = 0) {
    let yy = y, mm = mo;
    if (mm <= 2) { yy -= 1; mm += 12; }
    const a = Math.floor(yy / 100), b = 2 - a + Math.floor(a / 4);
    const jd = Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + b - 1524.5;
    return jd + (h + mi / 60 + s / 3600) / 24;
  }
  function fromJD(jd) {
    jd += 0.5;
    const z = Math.floor(jd), f = jd - z;
    let a = z;
    if (z >= 2299161) { const al = Math.floor((z - 1867216.25) / 36524.25); a = z + 1 + al - Math.floor(al / 4); }
    const b = a + 1524, c = Math.floor((b - 122.1) / 365.25), dd = Math.floor(365.25 * c);
    const e = Math.floor((b - dd) / 30.6001);
    const dayf = b - dd - Math.floor(30.6001 * e) + f;
    const day = Math.floor(dayf), frac = dayf - day;
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    const t = frac * 24, hour = Math.floor(t), minute = Math.floor((t - hour) * 60);
    const second = ((t - hour) * 60 - minute) * 60;
    return [year, month, day, hour, minute, second];
  }
  function deltaT(y) {
    if (y < 1600) { const u = (y - 1820) / 100; return -20 + 32 * u * u; }
    if (y < 1700) { const t = y - 1600; return 120 - 0.9808 * t - 0.01532 * t * t + t ** 3 / 7129; }
    if (y < 1800) { const t = y - 1700; return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000; }
    if (y < 1860) { const t = y - 1800; return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7; }
    if (y < 1900) { const t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174; }
    if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
    if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3; }
    if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
    if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
    if (y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (y < 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
    const u = (y - 1820) / 100; return -20 + 32 * u * u;
  }
  function nutation(T) {
    const o = (125.04452 - 1934.136261 * T) * D2R;
    const ls = (280.4665 + 36000.7698 * T) * D2R;
    const lm = (218.3165 + 481267.8813 * T) * D2R;
    const dp = -17.20 * Math.sin(o) - 1.32 * Math.sin(2 * ls) - 0.23 * Math.sin(2 * lm) + 0.21 * Math.sin(2 * o);
    return dp;
  }
  const ser = (t, tau) => t.reduce((s, [a, b, c]) => s + a * Math.cos(b + c * tau), 0);
  function earthL(T) {
    const tau = T / 10;
    const v = ser(D.VSOP_L0, tau) + ser(D.VSOP_L1, tau) * tau + ser(D.VSOP_L2, tau) * tau ** 2
      + ser(D.VSOP_L3, tau) * tau ** 3 + ser(D.VSOP_L4, tau) * tau ** 4 + ser(D.VSOP_L5, tau) * tau ** 5;
    return mod((v / 1e8) * R2D, 360);
  }
  function earthR(T) {
    const tau = T / 10;
    return (ser(D.VSOP_R0, tau) + ser(D.VSOP_R1, tau) * tau + ser(D.VSOP_R2, tau) * tau ** 2) / 1e8;
  }
  function sunLon(jde) {
    const T = (jde - 2451545) / 36525;
    let lam = earthL(T) + 180 - 0.09033 / 3600;
    lam += nutation(T) / 3600;
    lam -= 20.4898 / 3600 / earthR(T);
    return mod(lam, 360);
  }
  function solveLon(target, guess) {
    let jd = guess;
    for (let i = 0; i < 14; i++) {
      const diff = mod(sunLon(jd) - target + 180, 360) - 180;
      if (Math.abs(diff) < 1e-8) break;
      jd -= diff / 0.9856473;
    }
    return jd;
  }
  const _termCache = new Map();
  function termLocal(y, name) {
    const key = y + "|" + name;
    if (_termCache.has(key)) return _termCache.get(key);
    const idx = D.TERM_NAMES.indexOf(name), lon = idx * 15;
    const doy = mod(79 + (lon / 360) * 365.2422, 365.2422);
    let jde = solveLon(lon, toJD(y, 1, 1) + doy);
    const gy = fromJD(jde - deltaT(y) / 86400)[0];
    if (gy !== y) jde = solveLon(lon, toJD(y, 1, 1) + doy + 365.2422 * (y - gy));
    const t = jde - deltaT(y) / 86400 + 8 / 24;
    _termCache.set(key, t);
    return t;
  }
  function termDay(y, name) { return Math.floor(termLocal(y, name) + 0.5); }
  function newMoonJDE(k) {
    const T = k / 1236.85;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2 - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4;
    const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
    const M = (2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3) * D2R;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * D2R;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * D2R;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3) * D2R;
    const s = Math.sin;
    const corr = -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F)
      + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M)
      - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
      - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
      - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M)
      + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F)
      + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
      - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
    const A1 = (299.77 + 0.107408 * k - 0.009173 * T ** 2) * D2R;
    const A2 = (251.88 + 0.016321 * k) * D2R, A3 = (251.83 + 26.651886 * k) * D2R;
    const A4 = (349.42 + 36.412478 * k) * D2R, A5 = (84.66 + 18.206239 * k) * D2R;
    const A6 = (141.74 + 53.303771 * k) * D2R, A7 = (207.14 + 2.453732 * k) * D2R;
    const A8 = (154.84 + 7.30686 * k) * D2R;
    return jde + corr + 0.000325 * s(A1) + 0.000165 * s(A2) + 0.000164 * s(A3)
      + 0.000126 * s(A4) + 0.00011 * s(A5) + 0.000062 * s(A6) + 0.00006 * s(A7) + 0.000056 * s(A8);
  }
  function newMoonLocal(k) {
    const jde = newMoonJDE(k);
    return jde - deltaT(fromJD(jde)[0]) / 86400 + 8 / 24;
  }
  const kEst = (jd) => (jd - 2451550.09766) / 29.530588861;
  function eotMinutes(jd) {
    const jde = jd + deltaT(fromJD(jd)[0]) / 86400;
    const T = (jde - 2451545) / 36525;
    const lam = sunLon(jde) * D2R;
    const eps = (23 + 26 / 60 + 21.448 / 3600 - (46.815 * T + 0.00059 * T ** 2 - 0.001813 * T ** 3) / 3600) * D2R;
    let alpha = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * R2D;
    alpha = mod(alpha, 360);
    const L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T ** 2, 360);
    let e = L0 - 0.0057183 - alpha;
    e = mod(e + 180, 360) - 180;
    return e * 4;
  }

  /* ---------------- lunar calendar ---------------- */
  const DAY_OFFSET = 49;
  const dayNum = (t) => Math.floor(t + 0.5);
  const dayStart = (n) => n - 0.5;
  function lastNewMoonBefore(jd) {
    const target = dayNum(jd);
    let k = Math.floor(kEst(jd));
    while (dayNum(newMoonLocal(k)) > target) k--;
    while (dayNum(newMoonLocal(k + 1)) <= target) k++;
    return [k, newMoonLocal(k)];
  }
  const _suiStartCache = new Map();
  function suiStart(Y) {
    if (_suiStartCache.has(Y)) return _suiStartCache.get(Y);
    const v = dayStart(dayNum(lastNewMoonBefore(termLocal(Y, "冬至"))[1]));
    _suiStartCache.set(Y, v);
    return v;
  }
  const _suiCache = new Map();
  function sui(Y) {
    if (_suiCache.has(Y)) return _suiCache.get(Y);
    const k1 = lastNewMoonBefore(termLocal(Y, "冬至"))[0];
    const k2 = lastNewMoonBefore(termLocal(Y + 1, "冬至"))[0];
    const starts = [];
    for (let k = k1; k <= k2; k++) starts.push(dayNum(newMoonLocal(k)));
    const zq = [];
    [Y, Y + 1].forEach((yy) => D.ZHONGQI_NAMES.forEach((nm) => {
      const t = termDay(yy, nm);
      if (starts[0] <= t && t < starts[starts.length - 1]) zq.push(t);
    }));
    zq.sort((a, b) => a - b);
    const out = [starts, zq];
    _suiCache.set(Y, out);
    return out;
  }
  function numberMonths(starts, zq) {
    const n = starts.length - 1, hasZq = [], nums = [];
    for (let i = 0; i < n; i++) hasZq.push(zq.some((t) => starts[i] <= t && t < starts[i + 1]));
    let num = 11, prev = 11, used = false;
    for (let i = 0; i < n; i++) {
      if (n === 13 && !used && i > 0 && !hasZq[i]) { nums.push([true, prev]); used = true; }
      else { nums.push([false, num]); prev = num; num = num === 12 ? 1 : num + 1; }
    }
    return nums;
  }
  function suiOfJD(jd) {
    let Y = fromJD(jd)[0];
    while (suiStart(Y) > jd) Y--;
    while (suiStart(Y + 1) <= jd) Y++;
    return Y;
  }
  function lunarFromJD(jd) {
    const Y = suiOfJD(jd), [starts, zq] = sui(Y), nums = numberMonths(starts, zq);
    const n = starts.length - 1, di = dayNum(jd);
    for (let i = 0; i < n; i++) {
      if (starts[i] <= di && di < starts[i + 1]) {
        const [leap, mnum] = nums[i];
        const lday = di - starts[i] + 1, mdays = starts[i + 1] - starts[i];
        const leapMonth = (nums.find((x) => x[0]) || [0, 0])[1];
        const nyear = (mnum >= 11) ? Y : Y + 1;
        return { year: nyear, month: mnum, day: lday, isLeap: leap,
                 monthDays: mdays, leapMonth, monthStart: dayStart(starts[i]) };
      }
    }
    throw new Error("lunar fail " + jd);
  }

  function lunarToJD(year, month, day, isLeap) {
    for (const Y of [year - 1, year, year + 1]) {
      const [starts, zq] = sui(Y), nums = numberMonths(starts, zq);
      for (let i = 0; i < nums.length; i++) {
        const [lp, mn] = nums[i];
        if (lp === !!isLeap && mn === month) {
          const nyear = mn >= 11 ? Y : Y + 1;
          if (nyear === year) return dayStart(starts[i] + day - 1);
        }
      }
    }
    return null;
  }

  /* ---------------- pillars ---------------- */
  function yearPillar(jd) {
    const gy = fromJD(jd)[0];
    const sy = jd < termLocal(gy, "立春") ? gy - 1 : gy;
    const idx = mod(sy - 4, 60);
    return [GAN[idx % 10], ZHI[idx % 12], sy];
  }
  const JIE_ZHI = { 立春: "寅", 惊蛰: "卯", 清明: "辰", 立夏: "巳", 芒种: "午", 小暑: "未",
    立秋: "申", 白露: "酉", 寒露: "戌", 立冬: "亥", 大雪: "子", 小寒: "丑" };
  const TIGER = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
  function monthPillar(jd, yearGan) {
    const gy = fromJD(jd)[0];
    const marks = [];
    [gy - 1, gy, gy + 1].forEach((yy) => D.JIE_NAMES.forEach((nm) => marks.push([termLocal(yy, nm), nm])));
    marks.sort((a, b) => a[0] - b[0]);
    let cur = marks[0];
    for (const m of marks) { if (m[0] <= jd) cur = m; else break; }
    const zhi = JIE_ZHI[cur[1]];
    const first = TIGER[gi(yearGan)];
    return [GAN[mod(first + mod(zi(zhi) - 2, 12), 10)], zhi, cur[1]];
  }
  function dayPillar(jd, ziBoundary) {
    if (ziBoundary !== "zi_mid") {
      const frac = jd + 0.5 - Math.floor(jd + 0.5);
      if (frac >= 23 / 24) jd += 1;
    }
    const idx = mod(dayNum(jd) + DAY_OFFSET, 60);
    return [GAN[idx % 10], ZHI[idx % 12]];
  }
  const hourBranchOf = (h) => ZHI[Math.floor(mod(h + 1, 24) / 2)];
  function hourPillar(dayGan, hb) {
    const first = TIGER[gi(dayGan)] === undefined ? 0 : 0;
    const map = { 0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8 };
    return GAN[mod(map[gi(dayGan)] + zi(hb), 10)];
  }
  function ganzhiIndex(g, z) {
    for (let i = 0; i < 60; i++) if (i % 10 === gi(g) && i % 12 === zi(z)) return i;
    return 0;
  }
  const nayin = (g, z) => D.NAYIN[Math.floor(ganzhiIndex(g, z) / 2)];
  const xunkong = (g, z) => {
    const k = Math.floor(ganzhiIndex(g, z) / 10) * 10;
    return { 0: ["戌", "亥"], 10: ["申", "酉"], 20: ["午", "未"], 30: ["辰", "巳"], 40: ["寅", "卯"], 50: ["子", "丑"] }[k];
  };
  function shishen(dm, other) {
    const di = gi(dm), oi = gi(other);
    const dw = D.GAN_WUXING[di], ow = D.GAN_WUXING[oi];
    const same = di % 2 === oi % 2;
    if (dw === ow) return same ? "比肩" : "劫财";
    if (D.SHENG[dw] === ow) return same ? "食神" : "伤官";
    if (D.KE[dw] === ow) return same ? "偏财" : "正财";
    if (D.KE[ow] === dw) return same ? "七杀" : "正官";
    return same ? "偏印" : "正印";
  }
  function changsheng(stem, branch) {
    const start = { 甲: "亥", 乙: "午", 丙: "寅", 丁: "酉", 戊: "寅", 己: "酉", 庚: "巳", 辛: "子", 壬: "申", 癸: "卯" }[stem];
    const step = gi(stem) % 2 === 0 ? 1 : -1;
    return D.CHANGSHENG[mod((zi(branch) - zi(start)) * step, 12)];
  }

  /* ---------------- bazi chart ---------------- */
  function trueSolarOffset(jd, lon, tz) { return (lon - tz * 15) * 4 + eotMinutes(jd); }

  function buildBazi(o) {
    const jd = toJD(o.y, o.m, o.d, o.h, o.mi);
    let ts = { y: o.y, m: o.m, d: o.d, h: o.h, mi: o.mi };
    let jdT = jd;
    if (o.trueSolar !== false) {
      const dt = new Date(Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi));
      const off = trueSolarOffset(jd, o.lon, o.tz === undefined ? 8 : o.tz);
      const nd = new Date(dt.getTime() + off * 60000);
      ts = { y: nd.getUTCFullYear(), m: nd.getUTCMonth() + 1, d: nd.getUTCDate(), h: nd.getUTCHours(), mi: nd.getUTCMinutes() };
      jdT = toJD(ts.y, ts.m, ts.d, ts.h, ts.mi, nd.getUTCSeconds());
    }
    const ly = yearPillar(jd);
    const [mg, mz, jie] = monthPillar(jd, ly[0]);
    const [dg, dz] = dayPillar(jdT, o.ziBoundary);
    const hb = hourBranchOf(ts.h + ts.mi / 60);
    const hg = hourPillar(dg, hb);
    const dm = dg;
    const raw = [["year", ly[0], ly[1]], ["month", mg, mz], ["day", dg, dz], ["hour", hg, hb]];
    const pillars = raw.map(([pos, g, z]) => ({
      position: pos, gan: g, zhi: z,
      ganWx: D.GAN_WUXING[gi(g)], zhiWx: D.ZHI_WUXING[zi(z)],
      shishenGan: pos === "day" ? "日主" : shishen(dm, g),
      shishenZhi: shishen(dm, D.HIDDEN[z][0]),
      hidden: D.HIDDEN[z],
      nayin: nayin(g, z),
      stage: changsheng(g, z),
      kong: xunkong(g, z),
    }));
    const chart = {
      name: o.name || "", gender: o.gender,
      // birth 是「用户填的钟表时间」，trueSolar 才是校正后的时间。
      // 早前把两者混成一个字段，结果界面把校正后的 15:07 当成出生时间显示。
      birth: { y: o.y, m: o.m, d: o.d, h: o.h, mi: o.mi },
      trueSolar: ts,
      trueSolarApplied: o.trueSolar !== false,
      trueSolarOffset: o.trueSolar === false
        ? 0 : trueSolarOffset(jd, o.lon, o.tz === undefined ? 8 : o.tz),
      // jd 必须是「真实时刻」，不能是真太阳时校正后的读数：
      // 节气是北京时间的物理瞬间，用校正值去比会把同一天的节判成已过/未过，
      // 起运就会整整错开一个大运（1964-10-08 15:59 那例错开十年）。
      jd: jd,
      lunar: lunarFromJD(jd), pillars, dayMaster: dm,
      dayMasterWx: D.GAN_WUXING[gi(dm)],
    };
    chart.year = pillars[0]; chart.month = pillars[1];
    chart.day = pillars[2]; chart.hour = pillars[3];
    scoreElements(chart);
    analyseStructure(chart);
    analyseTiaohou(chart);
    findShensha(chart);
    findRelations(chart);
    return chart;
  }

  /* ---------------- relations -------------------------------------------
     Line-for-line port of mingli/bazi/relations.py. Change one, change the
     other: the 440-chart parity run is the only thing keeping the two engines
     from drifting, and it compares `strength` and `elementScores` numerically.
  */
  const REL_POSN = ["年", "月", "日", "时"];
  const REL_DIST = { 1: 1.0, 2: 0.72, 3: 0.5 };
  const REL_BASE = { "三会": 1.0, "三合": 0.95, "半合": 0.55, "拱合": 0.3,
    "六合": 0.4, "三刑": 0.9, "相刑": 0.5, "自刑": 0.45,
    "六冲": 0.85, "六害": 0.35, "六破": 0.3, "干合": 0.45, "干冲": 0.55 };
  // 半合只算牵动（0.35），不算化。旧值 0.65 会把原局印星直接抹掉：
  // 寅午两支就断定寅变成火，于是五行分布说寅是火、格位判定说寅是木
  const REL_SHARE_CAP = { "三会": 1, "三合": 1, "半合": 0.35, "拱合": 0.15,
    "六合": 0.35, "干合": 0.8 };
  const REL_SEASON = { 旺: 1.25, 相: 1.12, 休: 0.9, 囚: 0.8, 死: 0.7 };
  const REL_BRANCH_COMBINING = ["三会", "三合", "半合", "拱合", "六合"];
  const REL_TRANSFORM_AT = 0.55;

  function relDist(a, b) { return (a >= 4 || b >= 4) ? 2 : Math.abs(a - b); }

  function relPosWeight(pos) {
    if (pos.length < 2) return 1;
    let sum = 0, n = 0;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        sum += REL_DIST[Math.min(relDist(pos[i], pos[j]), 3)]; n++;
      }
    }
    return sum / n;
  }

  function relStrength(c, rel, stemEls) {
    let s = REL_BASE[rel.kind];
    if (rel.element) {
      const st = (D.SEASON_STATE[c.month.zhi] || {})[rel.element] || "休";
      s *= REL_SEASON[st];
      if (stemEls.has(rel.element)) s *= 1.15;
    }
    s *= relPosWeight(rel.pos);
    if (rel.pos.indexOf(1) >= 0) s *= 1.1;
    return Math.min(1.25, s);
  }

  function relTransforms(kind, s) {
    if (kind === "三会" || kind === "三合") return true;
    if (kind === "半合" || kind === "六合" || kind === "干合") return s >= REL_TRANSFORM_AT;
    return false;
  }

  // 同支去重：卯辰加一个辰只算两支。带外来支时，重复的字要落到外来支上，
  // 否则「这个寅做了什么」会用命局里本来就有的那个寅来回答。
  function relUnique(nodes, group) {
    const seen = {};
    nodes.forEach(([i, z]) => {
      if (group.slice(0, 3).indexOf(z) >= 0 && !(z in seen)) seen[z] = i;
    });
    const hasExtra = nodes.some(([i]) => i === 4);
    if (hasExtra) {
      Object.keys(seen).forEach((z) => {
        if (seen[z] !== 4 && nodes.some(([i, z2]) => i === 4 && z2 === z)) seen[z] = 4;
      });
    }
    return seen;
  }

  function relAnalyse(c, extra) {
    const nodes = c.pillars.map((p, i) => [i, p.zhi]);
    if (extra) nodes.push([4, extra]);
    const model = { items: [], nodes: nodes, merged: {}, stemMerged: {},
      suppressed: {}, tombstones: {}, tombMult: {}, extra: extra ? 4 : -1 };
    const stemEls = new Set(c.pillars.map((p) => p.ganWx));

    const claimed = {};
    [["三会", D.SANHUI], ["三合", D.SANHE]].forEach((pair) => {
      const kind = pair[0];
      pair[1].forEach((grp) => {
        const seen = relUnique(nodes, grp);
        if (Object.keys(seen).length !== 3) return;
        const rel = { kind: kind, pos: Object.values(seen), zhis: Object.keys(seen),
          element: grp[3] };
        rel.strength = relStrength(c, rel, stemEls);
        rel.transforms = true;
        rel.note = "";
        model.items.push(rel);
        rel.pos.forEach((i) => { claimed[i] = true; });
      });
    });

    D.SANHE.forEach((grp) => {
      const seen = relUnique(nodes, grp);
      if (Object.keys(seen).length !== 2) return;
      const pos = Object.values(seen);
      if (pos.some((i) => claimed[i])) return;
      const middle = grp[1] in seen;
      const kind = middle ? "半合" : "拱合";
      const rel = { kind: kind, pos: pos, zhis: Object.keys(seen), element: grp[3] };
      rel.strength = relStrength(c, rel, stemEls);
      rel.transforms = relTransforms(kind, rel.strength);
      rel.note = middle ? "带中神" : "无中神，拱而不实";
      model.items.push(rel);
    });

    const gans = c.pillars.map((p) => p.gan);
    const push = (kind, pos, zhis, element) => {
      const rel = { kind: kind, pos: pos, zhis: zhis, element: element || "", note: "" };
      rel.strength = relStrength(c, rel, stemEls);
      rel.transforms = relTransforms(kind, rel.strength);
      model.items.push(rel);
    };

    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const ia = nodes[a][0], za = nodes[a][1];
        const ib = nodes[b][0], zb = nodes[b][1];
        const pos = [ia, ib];
        if (D.HE6[za] === zb) {
          const key = [za, zb].slice().sort().join("");
          push("六合", pos, [za, zb], D.HE6_ELEMENT[key] || "");
        }
        if (D.CHONG[za] === zb) push("六冲", pos, [za, zb]);
        if (D.HAI6[za] === zb) push("六害", pos, [za, zb]);
        if (D.PO[za] === zb) push("六破", pos, [za, zb]);
        if (ia >= 4 || ib >= 4) continue;
        const ga = gans[ia], gb = gans[ib];
        if ((D.GAN_HE[ga] || [""])[0] === gb) push("干合", pos, [ga, gb], D.GAN_HE[ga][1]);
        if (D.GAN_CHONG[ga] === gb) push("干冲", pos, [ga, gb]);
      }
    }

    D.XING_FULL.forEach((grp) => {
      const seen = relUnique(nodes, grp);
      const n = Object.keys(seen).length;
      if (n === 3) push("三刑", Object.values(seen), Object.keys(seen));
      else if (n === 2) {
        const rel = { kind: "相刑", pos: Object.values(seen), zhis: Object.keys(seen),
          element: "", note: "" };
        rel.strength = relStrength(c, rel, stemEls) * 0.7;
        rel.transforms = false;
        model.items.push(rel);
      }
    });

    D.XING_PAIR.forEach((pair) => {
      nodes.forEach(([ia, za]) => {
        nodes.forEach(([ib, zb]) => {
          if (za === pair[0] && zb === pair[1]) push("相刑", [ia, ib], [za, zb]);
        });
      });
    });

    D.SELF_XING.forEach((z) => {
      const hits = nodes.filter(([i, zz]) => zz === z).map(([i]) => i);
      if (hits.length >= 2) push("自刑", [hits[0], hits[1]], [z, z]);
    });

    relResolveCompetition(model);
    return model;
  }

  function relResolveCompetition(model) {
    const counts = {}, kinds = {};
    model.items.forEach((r) => {
      if (REL_BRANCH_COMBINING.indexOf(r.kind) < 0) return;
      r.pos.forEach((i) => {
        counts[i] = (counts[i] || 0) + 1;
        (kinds[i] = kinds[i] || new Set()).add(r.kind);
      });
    });
    model.items.forEach((r) => {
      if (REL_BRANCH_COMBINING.indexOf(r.kind) < 0) return;
      const hit = r.pos.filter((i) => (counts[i] || 0) > 1);
      if (!hit.length) return;
      const same = hit.some((i) => (kinds[i] || new Set()).size === 1);
      r.strength *= same ? 0.55 : 0.75;
      r.note = (r.note + "；争合").replace(/^；/, "");
      r.transforms = relTransforms(r.kind, r.strength);
    });
    const stems = {};
    model.items.forEach((r) => {
      if (r.kind !== "干合") return;
      r.pos.forEach((i) => { stems[i] = (stems[i] || 0) + 1; });
    });
    model.items.forEach((r) => {
      if (r.kind !== "干合") return;
      if (!r.pos.some((i) => (stems[i] || 0) > 1)) return;
      r.strength *= 0.55;
      r.note = (r.note + "；妒合").replace(/^；/, "");
      r.transforms = relTransforms(r.kind, r.strength);
    });
  }

  function relBaseVector(zhi) {
    const h = D.HIDDEN[zhi];
    const w = h.length === 1 ? [1] : h.length === 2 ? [0.7, 0.3] : [0.6, 0.28, 0.12];
    const out = {};
    h.forEach((s, i) => {
      const el = D.GAN_WUXING[gi(s)];
      out[el] = (out[el] || 0) + w[i];
    });
    return out;
  }

  function relMix(vec, element, share) {
    const out = {};
    Object.keys(vec).forEach((e) => { out[e] = vec[e] * (1 - share); });
    out[element] = (out[element] || 0) + share;
    return out;
  }

  function relVector(model, idx) {
    const zhi = model.nodes.find(([i]) => i === idx)[1];
    let vec = relBaseVector(zhi);
    const m = model.merged[idx];
    if (m) vec = relMix(vec, m[0], m[1]);
    const f = model.suppressed[idx];
    if (f !== undefined) {
      Object.keys(vec).forEach((e) => { vec[e] *= f; });
    }
    return vec;
  }

  function relSettle(model, c) {
    model.items.forEach((r) => {
      if (REL_BRANCH_COMBINING.indexOf(r.kind) < 0 || !r.transforms) return;
      const share = Math.min(REL_SHARE_CAP[r.kind] || 1, r.strength);
      r.pos.forEach((i) => {
        if (i >= 4) { model.merged[i] = [r.element, share]; return; }
        if (model.merged[i] && model.merged[i][1] >= share) return;
        model.merged[i] = [r.element, share];
      });
    });

    model.items.forEach((r) => {
      if (r.kind !== "干合" || !r.transforms) return;
      const share = Math.min(REL_SHARE_CAP["干合"], r.strength);
      r.pos.forEach((i) => {
        if (i >= 4) return;
        if (!model.stemMerged[i] || model.stemMerged[i][1] < share) {
          model.stemMerged[i] = [r.element, share];
        }
      });
    });

    ["六冲", "三刑", "相刑", "自刑", "六害", "六破"].forEach((kind) => {
      model.items.forEach((r) => {
        if (r.kind !== kind) return;
        let bite = kind === "六冲" ? 0.22 * r.strength
          : (kind === "三刑" || kind === "相刑" || kind === "自刑")
            ? 0.14 * r.strength : 0.08 * r.strength;
        r.pos.forEach((i) => {
          let local = bite * (i >= 4 ? 0.6 : 1.0);
          if (i === 1) local *= 1.35;
          model.suppressed[i] = (model.suppressed[i] === undefined ? 1 : model.suppressed[i])
            * (1 - Math.min(0.5, local));
        });
      });
    });

    relSettleTombs(model);
    return model;
  }

  function relSettleTombs(model) {
    const totals = {};
    model.nodes.forEach(([i]) => {
      if (i >= 4) return;
      const v = relVector(model, i);
      Object.keys(v).forEach((e) => { totals[e] = (totals[e] || 0) + v[e]; });
    });
    const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    model.nodes.forEach(([i, z]) => {
      if (!(z in D.TOMB)) return;
      const stored = D.TOMB[z];
      const share = (totals[stored] || 0) / grand * 100;
      if (share <= 0) return;
      const kind = share >= 9.0 ? "库" : "墓";
      if (i >= 4) return;
      model.tombstones[i] = [kind, stored];
      if (kind === "墓") {
        model.tombMult[stored] = Math.min(model.tombMult[stored] === undefined ? 1 : model.tombMult[stored], 0.72);
      }
    });
  }

  function relVectors(model) {
    return [0, 1, 2, 3].map((i) => relVector(model, i));
  }

  function relIncoming(model) {
    if (model.extra < 0) return null;
    const idx = model.extra;
    const zhi = model.nodes.find(([i]) => i === idx)[1];
    const m = model.merged[idx];
    const element = m ? m[0] : D.ZHI_WUXING[D.ZHI.indexOf(zhi)];
    const share = m ? m[1] : 0;
    return { zhi: zhi, element: element, share: share, merged: !!m,
      suppressed: model.suppressed[idx] === undefined ? 1 : model.suppressed[idx],
      relations: model.items.filter((r) => r.pos.indexOf(idx) >= 0) };
  }

  function relLabel(r) {
    const body = r.zhis.join("");
    if (["三会", "三合", "半合", "拱合", "六合", "干合"].indexOf(r.kind) >= 0) {
      return body + r.kind + (r.transforms ? "化" + r.element : "不化");
    }
    return body + r.kind;
  }

  function relTally(model) {
    const out = { 三会: 0, 三合: 0, 半合: 0, 拱合: 0, 六合: 0, 三刑: 0,
      相刑: 0, 自刑: 0, 六冲: 0, 六害: 0, 六破: 0, 干合: 0, 干冲: 0 };
    let mergedShare = 0;
    model.items.forEach((r) => {
      out[r.kind] = (out[r.kind] || 0) + 1;
      if (REL_BRANCH_COMBINING.indexOf(r.kind) >= 0 && r.transforms) {
        mergedShare += r.strength * r.pos.length / 4;
      }
    });
    out.total = model.items.length;
    out.mergedShare = Math.round(mergedShare * 100) / 100;
    out.tomb = Object.values(model.tombstones).filter((v) => v[0] === "墓").length;
    out.store = Object.values(model.tombstones).filter((v) => v[0] === "库").length;
    out.clashN = out["六冲"] + out["三刑"] + out["相刑"] + out["自刑"];
    out.combineN = out["三会"] + out["三合"] + out["半合"] + out["六合"] + out["拱合"];
    return out;
  }

  function scoreElements(c) {
    const rel = relSettle(relAnalyse(c), c);
    c.relationsModel = rel;
    const vectors = relVectors(rel);

    const sc = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    c.pillars.forEach((p, i) => {
      const sm = rel.stemMerged[i];
      if (sm) {
        sc[p.ganWx] += D.STEM_W[p.position] * (1 - sm[1]);
        sc[sm[0]] += D.STEM_W[p.position] * sm[1];
      } else {
        sc[p.ganWx] += D.STEM_W[p.position];
      }
      const v = vectors[i];
      Object.keys(v).forEach((el) => { sc[el] += D.BRANCH_W[p.position] * v[el]; });
    });
    Object.keys(rel.tombMult).forEach((el) => { sc[el] *= rel.tombMult[el]; });

    const state = D.SEASON_STATE[c.month.zhi];
    Object.keys(state).forEach((el) => { sc[el] *= D.STATE_MULT[state[el]]; });
    const total = Object.values(sc).reduce((a, b) => a + b, 0) || 1;
    c.elementScores = {};
    Object.keys(sc).forEach((k) => { c.elementScores[k] = Math.round(sc[k] / total * 10000) / 100; });
    const dmwx = c.dayMasterWx;
    const yin = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
    const ally = c.elementScores[dmwx] + c.elementScores[yin];
    c.strength = Math.round(ally * 100) / 100;
    c.strengthLabel = ally >= 62 ? "极强" : ally >= 52 ? "偏强" : ally >= 45 ? "中和" : ally >= 37 ? "偏弱" : "极弱";
    c.seasonalState = state;
  }

  function analyseStructure(c) {
    const dm = c.dayMaster, mz = c.month.zhi, mh = D.HIDDEN[mz];
    const trans = c.pillars.filter((p) => p.position !== "day").map((p) => p.gan);
    const cands = [];
    mh.forEach((h, i) => { if (trans.includes(h)) cands.push([h, ["本气", "中气", "余气"][i]]); });
    const mwx = D.ZHI_WUXING[zi(mz)];
    const NAME = { 正官: "正官格", 七杀: "七杀格", 正财: "正财格", 偏财: "偏财格",
      食神: "食神格", 伤官: "伤官格", 正印: "正印格", 偏印: "偏印格" };
    let name = "", basis = "", kind = "普通格";
    if (cands.length) {
      const [h, layer] = cands[0], ss = shishen(dm, h);
      if (ss === "比肩" || ss === "劫财") {
        if (mz === D.LU[dm]) { name = "建禄格"; basis = `月令${mz}为日主临官（禄）之地，${h}透干，取建禄格`; }
        else if (mz === D.YANGREN[dm]) { name = "月刃格"; basis = `月令${mz}为日主帝旺（羊刃）之地，${h}透干，取月刃格`; }
        else { name = ss + "格"; basis = `月令${mz}藏${h}透干，${ss}当权，不属禄刃`; }
      } else {
        name = NAME[ss]; basis = `月令${mz}藏${h}（${layer}）透于天干，以${ss}取格`;
      }
    } else if (mwx === c.dayMasterWx) {
      if (mz === D.LU[dm]) { name = "建禄格"; basis = `月令${mz}为日主临官（禄）之地，取建禄格`; }
      else if (mz === D.YANGREN[dm]) { name = "月刃格"; basis = `月令${mz}为日主帝旺（羊刃）之地，取月刃格`; }
      else { name = "比劫格"; basis = `月令${mz}为日主同类之地，取比劫格`; }
    } else {
      const h = mh[0], ss = shishen(dm, h);
      name = NAME[ss] || "杂气格";
      basis = `月令${mz}藏干不透，以本气${h}（${ss}）论格`;
    }
    const dmwx = c.dayMasterWx;
    const keMe = Object.keys(D.KE).find((k) => D.KE[k] === dmwx);
    const cai = D.KE[dmwx];
    if (c.strengthLabel === "极弱") {
      const yin = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
      const hidden = c.pillars.flatMap((p) => p.hidden);
      const root = hidden.some((h) => [dmwx, yin].includes(D.GAN_WUXING[gi(h)]));
      if (!root) { name = "从格（从势/从财杀）"; basis = "日主极弱、四柱无根无印，弃命从势，宜顺不宜逆"; kind = "特殊格"; }
    }
    if (c.strengthLabel === "极强" && c.elementScores[dmwx] >= 55
        && c.elementScores[keMe] < 6 && c.elementScores[cai] < 6) {
      name = { 木: "曲直仁寿格", 火: "炎上格", 土: "稼穑格", 金: "从革格", 水: "润下格" }[dmwx];
      basis = `日主${dmwx}气贯全局（${c.elementScores[dmwx].toFixed(1)}%），成专旺之象`;
      kind = "特殊格";
    }
    c.structure = { name, basis, kind, transparent: cands };
  }

  function analyseTiaohou(c) {
    const seq = D.TIAOHOU[c.dayMaster][c.month.zhi] || "";
    const present = new Set(c.pillars.map((p) => p.gan).concat(c.pillars.flatMap((p) => p.hidden)));
    c.tiaohou = {
      sequence: seq, primary: seq[0] || "", secondary: seq[1] || "",
      satisfied: [...seq].filter((ch) => present.has(ch)),
      missing: [...seq].filter((ch) => !present.has(ch)),
    };
  }

  function findShensha(c) {
    const SS = D.SHENSHA, POSN = ["年", "月", "日", "时"];
    const dm = c.dayMaster;
    const zhis = c.pillars.map((p) => p.zhi), gans = c.pillars.map((p) => p.gan);
    const yz = c.year.zhi, dz = c.day.zhi, mz = c.month.zhi;
    const out = {};
    const put = (name, positions, basis) => {
      if (!positions.length) return;
      const def = SS.DEFS[name] || ["中", ""];
      const e = out[name] = out[name] || { nature: def[0], desc: def[1], positions: [], basis };
      positions.forEach((p) => { if (!e.positions.includes(p)) e.positions.push(p); });
    };
    const find = (target) => POSN.filter((_, i) => target.includes(zhis[i]));
    const stemOrBranch = (chars) => {
      const a = [], b = [];
      c.pillars.forEach((p, i) => { if (chars.includes(p.zhi)) a.push(POSN[i]); if (chars.includes(p.gan)) b.push(POSN[i]); });
      return a.concat(b);
    };
    // 年干与日干双查：口诀是「以年干或日干起贵人」，只查日干会漏一半
    const yg = c.year.gan;
    [["天乙贵人", SS.TIANYI], ["太极贵人", SS.TAIJI], ["文昌贵人", SS.WENCHANG],
     ["国印贵人", SS.GUOYIN], ["福星贵人", SS.FUXING], ["金舆", SS.JINYU],
     ["红艳", SS.HONGYAN], ["流霞", SS.LIUXIA], ["学堂", SS.XUETANG],
     ["禄神", SS.LU], ["羊刃", SS.YANGREN]].forEach(([nm, tbl]) => {
      let hits = find(tbl[dm]);
      let basis = `日干${dm}查${nm}`;
      if (yg !== dm) {
        const more = find(tbl[yg] || "");
        if (more.length) { hits = hits.concat(more); basis += `；年干${yg}查${nm}`; }
      }
      put(nm, hits, basis);
    });
    [["驿马", SS.YIMA], ["桃花", SS.TAOHUA], ["华盖", SS.HUAGAI], ["将星", SS.JIANGXING],
     ["劫煞", SS.JIESHA], ["灾煞", SS.ZAISHA], ["亡神", SS.WANGSHEN]].forEach(([nm, tbl]) => {
      put(nm, find(tbl[yz]).concat(find(tbl[dz])), `年支/日支三合局查${nm}`);
    });
    // 日干系（续）：天官 / 天厨 / 飞刃
    [["天官贵人", SS.TIANGUAN], ["天厨贵人", SS.TIANCHU]].forEach(([nm, tbl]) => {
      let hits = find(tbl[dm] || "");
      let basis = `日干${dm}查${nm.slice(0, 2)}`;
      if (yg !== dm) {
        const more = find(tbl[yg] || "");
        if (more.length) { hits = hits.concat(more); basis += `；年干${yg}查${nm.slice(0, 2)}`; }
      }
      put(nm, hits, basis);
    });
    const blade = SS.YANGREN[dm];
    if (blade) put("飞刃", find(ZHI[mod(zi(blade) + 6, 12)]), `羊刃${blade}之冲为飞刃`);

    // 月令德气：德干透出为龙德，德秀俱透为德秀贵人
    const ds = SS.DESHOW[mz] || ["", ""];
    const de = ds[0] || "", xiu = ds[1] || "";
    const deHit = POSN.filter((_, i) => de.includes(c.pillars[i].gan));
    const xiuHit = POSN.filter((_, i) => xiu.includes(c.pillars[i].gan));
    put("龙德", deHit, `月支${mz}德干${de}透出`);
    if (deHit.length && xiuHit.length) {
      put("德秀贵人", deHit.concat(xiuHit), `月支${mz}德${de}、秀${xiu}俱透`);
    }

    // 天德合 / 月德合：天德为干取合干，为支取六合支
    const td = SS.TIANDE[mz];
    const tdHe = (td && SS.GAN_HE_MAP[td]) || (td && SS.ZHI_HE_MAP[td]) || "";
    if (tdHe) put("天德合", stemOrBranch(tdHe), `${mz}月天德为${td}，合之为${tdHe}`);
    const md = SS.YUEDE[mz];
    const mdHe = (md && SS.GAN_HE_MAP[md]) || "";
    if (mdHe) put("月德合", stemOrBranch(mdHe), `${mz}月月德为${md}，合之为${mdHe}`);

    // 日柱系（续）—— 用独立变量名，此处离下面的 gz 声明还在 TDZ 里
    const dayPair = c.day.gan + c.day.zhi;
    if (SS.JINSHEN.includes(dayPair)) put("金神", ["日"], "金神三日之一（乙丑/己巳/癸酉）");
    if (SS.LIUXIU.includes(dayPair)) put("六秀日", ["日"], "六秀日");
    if (SS.SHILING.includes(dayPair)) put("十灵日", ["日"], "十灵日");
    if (SS.GULUAN.includes(dayPair)) put("孤鸾煞", ["日"], "孤鸾八日之一");
    if (SS.RIDE.includes(dayPair)) put("日德", ["日"], "日德五日之一");

    const hong = mod(3 - zi(yz), 12);
    put("红鸾", find(ZHI[hong]), `年支${yz}查红鸾`);
    put("天喜", find(ZHI[mod(hong + 6, 12)]), "红鸾对宫为天喜");
    put("孤辰", find(SS.GUSHEN[yz]), `年支${yz}查孤辰`);
    put("寡宿", find(SS.GUASU[yz]), `年支${yz}查寡宿`);
    put("破碎", find(SS.POSUI[yz]), `年支${yz}查破碎`);
    put("蜚廉", find(SS.FEILIAN[yz]), `年支${yz}查蜚廉`);

    // 年支系（续）：元辰与勾绞分「阳男阴女 / 阴男阳女」，是唯一依赖性别的两张表
    const male = ["male", "m", "男", "M", "Male"].indexOf(String(c.gender)) >= 0;
    const yangPath = ("甲丙戊庚壬".indexOf(c.year.gan) >= 0) === male;
    const yi = ZHI.indexOf(yz);
    const yc = (yangPath ? SS.YUANCHEN_YANG : SS.YUANCHEN_YIN)[yz];
    put("元辰", find(yc), `年支${yz}${yangPath ? "阳男阴女" : "阴男阳女"}查元辰（${yc}）`);
    const gou = ZHI[mod(yi + (yangPath ? 3 : -3), 12)];
    const jiao = ZHI[mod(yi + (yangPath ? -3 : 3), 12)];
    put("勾绞", find(gou + jiao), `年支${yz}，勾${gou}绞${jiao}`);
    put("六厄", find(SS.LIUE[yz]), `年支${yz}三合死位为六厄`);
    put("丧门", find(ZHI[mod(yi + 2, 12)]), `年支${yz}前二位为丧门`);
    put("吊客", find(ZHI[mod(yi - 2, 12)]), `年支${yz}后二位为吊客`);
    put("天德贵人", stemOrBranch(SS.TIANDE[mz]), `月支${mz}查天德`);
    put("月德贵人", stemOrBranch(SS.YUEDE[mz]), `月支${mz}查月德`);
    put("天医", find(ZHI[mod(zi(mz) - 1, 12)]), `月支${mz}前一位为天医`);
    const season = Object.keys(SS.TIANSHU_HIT).find((k) => k.includes(mz));
    const [sg, sz] = SS.TIANSHU_HIT[season];
    if (c.day.gan === sg && c.day.zhi === sz) put("天赦", ["日"], `${mz}月天赦`);
    const sf = SS.SIFEI[season];
    if (sf.includes(c.day.gan + c.day.zhi)) put("四废", ["日"], `${mz}月四废日`);
    const gz = c.day.gan + c.day.zhi;
    if (SS.KUIGANG.includes(gz)) put("魁罡", ["日"], "魁罡四日之一");
    if (SS.SHIE_DABAI.includes(gz)) put("十恶大败", ["日"], "十恶大败日");
    if (SS.YINYANG_CUO.includes(gz)) put("阴阳差错", ["日"], "阴阳差错日");
    put("空亡", POSN.filter((_, i) => c.pillars[i].kong.includes(zhis[i])), "按日柱旬空");
    SS.SANQI.forEach(([a, b, cc, label]) => {
      if ([a, b, cc].every((x) => gans.includes(x))) put("三奇贵人", ["全局"], `${label}齐见`);
    });
    const sky = zhis.filter((z) => ["戌", "亥"].includes(z));
    const net = zhis.filter((z) => ["辰", "巳"].includes(z));
    const hits = [];
    if (sky.length >= 2) hits.push(...find("戌"), ...find("亥"));
    if (net.length >= 2) hits.push(...find("辰"), ...find("巳"));
    put("天罗地网", [...new Set(hits)].sort((a, b) => POSN.indexOf(a) - POSN.indexOf(b)), "戌亥天罗 / 辰巳地网齐见");
    const ord = { 吉: 0, 中: 1, 凶: 2 };
    const keys = Object.keys(out).sort((a, b) => (ord[out[a].nature] - ord[out[b].nature]) || (out[b].positions.length - out[a].positions.length));
    const res = {};
    keys.forEach((k) => { res[k] = out[k]; });
    c.shensha = res;
    return res;
  }

  function zhiRels(a, b) {
    const out = [];
    if (D.HE6[a] === b) out.push("六合");
    if (D.CHONG[a] === b) out.push("六冲");
    if (D.HAI6[a] === b) out.push("相害");
    if (D.PO[a] === b) out.push("相破");
    [["子", "卯"], ["寅", "巳", "申"], ["丑", "戌", "未"]].forEach((g) => {
      if (g.includes(a) && g.includes(b) && a !== b) out.push("相刑");
    });
    if (a === b) out.push(["辰", "午", "酉", "亥"].includes(a) ? "自刑" : "伏吟");
    return out;
  }
  function ganRels(a, b) {
    const out = [];
    if (D.GAN_HE[a] && D.GAN_HE[a][0] === b) out.push("天干五合");
    if (D.GAN_CHONG[a] === b) out.push("天干相冲");
    return out;
  }
  function findRelations(c) {
    const pos = ["年", "月", "日", "时"], zs = c.pillars.map((p) => p.zhi), gs = c.pillars.map((p) => p.gan);
    const rel = {};
    const add = (k, v) => { (rel[k] = rel[k] || []).push(v); };
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      // 盘面只记合/冲/害/破/刑；伏吟与自刑属于岁运层面的说法，不在此处计
      zhiRels(zs[i], zs[j]).forEach((t) => {
        const key = { 六合: "合", 六冲: "冲", 相害: "害", 相破: "破", 相刑: "刑" }[t];
        if (!key) return;
        add(key, { pair: `${pos[i]}${zs[i]}·${pos[j]}${zs[j]}`, type: t });
      });
      ganRels(gs[i], gs[j]).forEach((t) => {
        add(t === "天干五合" ? "干合" : "干冲", { pair: `${pos[i]}${gs[i]}·${pos[j]}${gs[j]}`, type: t });
      });
    }
    D.SANHE.forEach((grp) => {
      const uniq = [...new Set(zs.filter((z) => grp.slice(0, 3).includes(z)))];
      if (uniq.length === 3) add("三合", { pair: uniq.join(""), type: `三合${grp[3]}局` });
      else if (uniq.length === 2) add("半合", { pair: uniq.join(""), type: `半合${grp[3]}局` });
    });
    D.SANHUI.forEach((grp) => {
      // 去重后恰好三个不同地支；直接数命中个数会把 申申酉戌 也算成三会
      const seen = [...new Set(zs.filter((z) => grp.slice(0, 3).includes(z)))];
      if (seen.length === 3) add("三会", { pair: seen.join(""), type: `三会${grp[3]}方` });
    });
    // 自刑：同一地支重复出现（辰午酉亥）
    [...new Set(zs)].forEach((z) => {
      if (zs.filter((x) => x === z).length >= 2 && ["辰", "午", "酉", "亥"].includes(z)) {
        add("刑", { pair: z + z, type: "自刑" });
      }
    });
    c.relations = rel;
  }

  /* ---------------- luck ---------------- */
  function luckDirection(c) {
    const yang = gi(c.year.gan) % 2 === 0;
    const male = ["male", "男", "m"].includes(c.gender);
    return yang === male ? 1 : -1;
  }
  function surroundingJie(c) {
    const gy = c.birth.y, marks = [];
    for (let yy = gy - 2; yy <= gy + 2; yy++) D.JIE_NAMES.forEach((nm) => marks.push([termLocal(yy, nm), nm]));
    marks.sort((a, b) => a[0] - b[0]);
    let prev = marks[0], next = marks[marks.length - 1];
    for (let i = 0; i < marks.length; i++) {
      if (marks[i][0] <= c.jd) { prev = marks[i]; if (i + 1 < marks.length) next = marks[i + 1]; }
      else break;
    }
    return [prev, next];
  }
  function startLuck(c) {
    const dir = luckDirection(c);
    const [prev, next] = surroundingJie(c);
    const days = dir > 0 ? next[0] - c.jd : c.jd - prev[0];
    const tm = days * 4;
    let years = Math.floor(tm / 12), months = Math.round(tm - years * 12);
    if (months >= 12) { years++; months -= 12; }
    const startYear = c.birth.y + years + ((c.birth.m + months) > 12 ? 1 : 0);
    return { years, months, dir, startYear };
  }
  function luckCycles(c, count, asOf) {
    const { years, dir, startYear } = startLuck(c);
    const midx = ganzhiIndex(c.month.gan, c.month.zhi);
    const now = asOf || new Date().getFullYear();
    const out = [];
    for (let k = 1; k <= (count || 10); k++) {
      const idx = mod(midx + dir * k, 60), g = GAN[idx % 10], z = ZHI[idx % 12];
      const sy = startYear + (k - 1) * 10;
      out.push({ index: k, gan: g, zhi: z, label: g + z,
        startAge: years + (k - 1) * 10, endAge: years + (k - 1) * 10 + 9,
        startYear: sy, endYear: sy + 9,
        shishenGan: shishen(c.dayMaster, g), shishenZhi: shishen(c.dayMaster, D.HIDDEN[z][0]),
        active: sy <= now && now <= sy + 9 });
    }
    return out;
  }
  const POS_W = { 年: 0.7, 月: 1.0, 日: 1.3, 时: 0.8 };
  const REP_GAN = { 木: "甲", 火: "丙", 土: "戊", 金: "庚", 水: "壬" };

  // 流年/流月地支进入原局后的实际五行：三合/三会齐则化神完全生效，半合减半。
  // 旧版只把它记成一句「与命局成三合火局」并按 ±5.5 扣分，五行与十神仍按本气算，
  // 于是「寅」永远当木（偏财），哪怕寅午戌早已合成火局（七杀成群）。
  // 流年/流月地支进入原局后的实际五行，全部交给 relations 判：
  // 三会三合齐则整体转化，半合半化，六合要月令支持才化，争合与妒合各自减半。
  // 旧版只认「三合齐 / 半合」两档、且不看月令与透干，于是寅午在冬天也算火局。
  function zhiEffective(c, zhi) {
    const model = relSettle(relAnalyse(c, zhi), c);
    const info = relIncoming(model);
    let note = "";
    if (info.merged) {
      const cand = info.relations.filter((r) =>
        ["三会", "三合", "半合", "六合"].indexOf(r.kind) >= 0 && r.transforms);
      cand.sort((a, b) => b.strength - a.strength);
      if (cand.length) {
        const rel = cand[0];
        note = `${zhi}与原局${rel.kind}成${rel.element}局`;
        if (rel.note) note += `（${rel.note}）`;
      }
    }
    return [info.element, note, info.share];
  }

  function elementOf(g, z, mergedWx) {
    const d = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    d[D.GAN_WUXING[gi(g)]] += 0.4;
    if (mergedWx) { d[mergedWx] += 0.6; return d; }
    const h = D.HIDDEN[z], w = h.length === 1 ? [1] : h.length === 2 ? [0.7, 0.3] : [0.6, 0.28, 0.12];
    h.forEach((s, i) => { d[D.GAN_WUXING[gi(s)]] += 0.6 * w[i]; });
    return d;
  }
  const GWX_MAP = (() => { const o = {}; D.GAN.split("").forEach((g, i) => { o[g] = D.GAN_WUXING[i]; }); return o; })();

  /* ---- 用神体系：与 mingli/bazi/gexi.py 逐条对应 ----------------------
     旧版只看日主强弱，身强取食伤财官、身弱取印比，再把调候主用塞进去，
     喜用动辄三四个五行、忌神两个 —— 五个五行全被分类，没有闲神，
     于是每年都被判吉凶，读数还在两端反复跳。
     这一版：强弱定方向、格局定先后；喜用一到两个五行，忌神一到两个，
     其余的才是闲神，也才有「平年」。 */
  const GE_KEY = {
    "正官格": "正官", "七杀格": "七杀", "正财格": "正财", "偏财格": "偏财",
    "食神格": "食神", "伤官格": "伤官", "正印格": "正印", "偏印格": "偏印",
    "建禄格": "建禄", "月刃格": "月刃", "比劫格": "比劫",
    "比肩格": "比劫", "劫财格": "比劫", "杂气格": "杂气",
    "从格（从势/从财杀）": "从格",
    "曲直仁寿格": "专旺", "炎上格": "专旺", "稼穑格": "专旺",
    "从革格": "专旺", "润下格": "专旺"
  };
  const GE_PREF = {
    正官: { like: ["正财", "偏财", "正印", "偏印"], dislike: ["伤官", "七杀"] },
    七杀: { like: ["食神", "伤官", "正印", "偏印"], dislike: ["正财", "偏财"] },
    正财: { like: ["食神", "伤官", "正官"], dislike: ["比肩", "劫财"] },
    偏财: { like: ["食神", "伤官", "正官", "七杀"], dislike: ["比肩", "劫财"] },
    正印: { like: ["正官", "七杀", "比肩"], dislike: ["正财", "偏财"] },
    偏印: { like: ["正官", "七杀"], dislike: ["偏财", "正财"] },
    食神: { like: ["正财", "偏财", "食神"], dislike: ["偏印"] },
    伤官: { like: ["正财", "偏财", "正印"], dislike: ["正官"] },
    建禄: { like: ["正官", "七杀", "正财", "食神"], dislike: ["比肩", "劫财", "正印", "偏印"] },
    月刃: { like: ["正官", "七杀"], dislike: ["比肩", "劫财", "正印", "偏印"] },
    比劫: { like: ["正官", "七杀", "正财"], dislike: ["比肩", "劫财"] },
    杂气: { like: [], dislike: [] },
    从格: { like: [], dislike: [] },
    专旺: { like: [], dislike: [] }
  };
  const GOD_CLASS = {
    比肩: "比劫", 劫财: "比劫", 食神: "食伤", 伤官: "食伤",
    正财: "财", 偏财: "财", 正官: "官杀", 七杀: "官杀", 正印: "印", 偏印: "印"
  };
  const CLASS_ZH = { 比劫: "比劫（同党）", 食伤: "食伤（泄秀）", 财: "财（耗身）",
    官杀: "官杀（制身）", 印: "印（生身）" };
  const geKey = (n) => GE_KEY[n] || "杂气";
  const elOfClass = (dmwx, cls) => {
    if (cls === "比劫") return dmwx;
    if (cls === "食伤") return D.SHENG[dmwx];
    if (cls === "财") return D.KE[dmwx];
    if (cls === "官杀") return Object.keys(D.KE).find((k) => D.KE[k] === dmwx);
    return Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
  };
  const presentEls = (c) => {
    const s = new Set();
    c.pillars.forEach((p) => {
      s.add(GWX_MAP[p.gan]);
      (p.hidden || []).forEach((h) => s.add(GWX_MAP[h]));
    });
    return s;
  };
  const strongestEl = (c, exclude) => {
    const es = c.elementScores;
    return ["木", "火", "土", "金", "水"]
      .filter((k) => k !== exclude)
      .sort((a, b) => es[b] - es[a])[0];
  };

  // 用神定了以后谁来帮它、谁来拆它 —— 按十神生克，不是「生用神者」。
  // 「生用神者为喜」只在官杀为用时成立；食伤为用时生它的是比劫，加柴而已。
  // 相神 = 用神之外、与用神**同方向**的两类十神。
  // 旧表把「克用神者」当忌神，套到扶抑上就翻车：丙火身旺取官杀（水）为用，
  // 表里写「食伤克官 → 土为忌」，而土正是泄旺火之物 —— 把药当成了病。
  const SAME_DIRECTION = {
    "官杀": ["财", "食伤"], "财": ["食伤", "官杀"], "食伤": ["财", "官杀"],
    "印": ["比劫"], "比劫": ["印"]
  };
  // 占到全局这个比例的五行已经是「病」不是「药」，不能再取为用神
  const DOMINANT_SHARE = 34.0;
  // 用神要「用得上」：低于这个比例，方向再对也没有力量
  const MIN_ROOT_SHARE = 3.0;

  //: favor 内部的分量：用神 1.0、第一相神 0.65、次喜 0.40
  const FAVOR_W = [1.0, 0.65, 0.40];

  function favorWeight(sysd, el) {
    if (!sysd) return 0;
    const f = sysd.favor || [];
    const i = f.indexOf(el);
    if (i >= 0) return FAVOR_W[Math.min(i, FAVOR_W.length - 1)];
    if ((sysd.avoid || []).includes(el)) return -1.0;
    if ((sysd.rescue || []).includes(el)) return 0.5;
    return 0;
  }

  function usefulElements(c) {
    const dmwx = c.dayMasterWx;
    const ge = geKey((c.structure || {}).name || "");
    const pref = GE_PREF[ge] || { like: [], dislike: [] };
    const present = presentEls(c);
    const es = c.elementScores;
    const strong = c.strength >= 50;
    const why = [];
    let primary = "", primaryCls = "";

    if (ge === "专旺") {
      primary = dmwx; primaryCls = "比劫";
      why.push(`专旺格以${dmwx}为体，顺其旺势，不逆不克`);
    } else if (ge === "从格") {
      primary = strongestEl(c, dmwx);
      primaryCls = elClass(dmwx, primary);
      why.push(`从格弃命从势，顺势取${primary}（${CLASS_ZH[primaryCls]}）`);
    } else {
      let order;
      if (c.strength >= 62) {
        order = ["正官", "七杀", "正财", "偏财", "食神", "伤官"];
        why.push(`日主偏强（同党 ${c.strength.toFixed(1)}%），宜泄宜克`);
      } else if (c.strength < 42) {
        order = ["正印", "偏印", "比肩", "劫财"];
        why.push(`日主偏弱（同党 ${c.strength.toFixed(1)}%），宜生宜扶`);
      } else {
        order = pref.like.length ? pref.like.slice() : ["正官", "正财", "食神"];
        why.push(`日主中和（同党 ${c.strength.toFixed(1)}%），依格局取用`);
      }
      // 格局定先后：格局所喜者提到前面
      order = order.filter((g) => pref.like.includes(g))
        .concat(order.filter((g) => !pref.like.includes(g)));
      const cands = [], seen = new Set();
      for (const god of order) {
        const cls = GOD_CLASS[god];
        const el = elOfClass(dmwx, cls);
        if (!present.has(el) || seen.has(el)) continue;
        seen.add(el);
        cands.push({ god, cls, el, rank: pref.like.includes(god) ? 0 : 1, share: es[el] || 0 });
      }
      // 过旺的不能当用神（那是病），太弱的也当不了（用不上）
      const fit = cands.filter((x) => x.share <= DOMINANT_SHARE);
      const rooted = fit.filter((x) => x.share >= MIN_ROOT_SHARE);
      const pool = (rooted.length ? rooted : (fit.length ? fit : cands)).slice()
        .sort((a, b) => (a.rank - b.rank) || (a.share - b.share));
      if (pool.length) {
        primary = pool[0].el; primaryCls = pool[0].cls;
        why.push(`取${pool[0].god}所属之${primary}（${CLASS_ZH[primaryCls]}）为用，局中占 ${pool[0].share.toFixed(1)}%`);
        if (cands.length > fit.length) {
          why.push(`${cands.filter((x) => x.share > DOMINANT_SHARE).map((x) => x.el).join("")}已过旺（> ${DOMINANT_SHARE}%），不作用神`);
        }
      }
      if (!primary) {
        primary = strongestEl(c, "");
        primaryCls = elClass(dmwx, primary);
        why.push(`喜用不见于四柱，就命局最旺之${primary}论用，用神虚而力薄`);
      }
    }

    // favor 是**有序**的：第 1 个是用神，后面依次是相神、次喜。
    // 顺序即权重，由 favorWeight() 取值 —— 旧版「在列表里就算满分」，
    // 三喜的盘等于三个满分，喜神一多整体虚高、忌神一多整体虚低。
    const favor = [primary];
    (SAME_DIRECTION[primaryCls] || []).forEach((cls) => {
      const el = elOfClass(dmwx, cls);
      if (el !== primary && !favor.includes(el)) favor.push(el);
    });

    const yin = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
    const avoid = [];
    if (strong) {
      // 身旺：生我（印）与同我（比劫）是病
      [yin, dmwx].forEach((el) => {
        if (!favor.includes(el) && !avoid.includes(el)) avoid.push(el);
      });
    } else {
      // 身弱：克我、我克、我生 三者为病，取局中最旺的两个
      const cand = ["官杀", "财", "食伤"]
        .map((cls) => elOfClass(dmwx, cls))
        .filter((el) => !favor.includes(el) && !avoid.includes(el))
        .sort((a, b) => (es[b] || 0) - (es[a] || 0));
      cand.slice(0, 2).forEach((el) => avoid.push(el));
    }
    const rescue = [yin, dmwx].filter((el) => !favor.includes(el) && !avoid.includes(el)).slice(0, 2);
    if (avoid.length) {
      why.push("忌" + avoid.join("") + "（" + (strong ? "生我、同我，加重偏旺" : "克我、耗我、泄我") + "）");
    }

    // 忌神不得为空：空则无事可忌，每年都成了吉年。
    // 身弱盘上「官杀/财/食伤」可能全落在 favor 里（从格边缘），这时补最该防的一个。
    if (!avoid.length) {
      const hurt = Object.keys(D.KE).find((k) => D.KE[k] === primary);  // 克用神者
      const feed = D.SHENG[primary];                                    // 用神所生（泄用神）
      for (const el of [hurt, feed]) {
        if (el && !favor.includes(el)) { avoid.push(el); break; }
      }
    }

    const ents = ["木", "火", "土", "金", "水"];
    // 闲神允许为空 —— 五行分完不是问题，favor 内部本来就有主次
    const neutral = ents.filter((k) => !favor.includes(k) && !avoid.includes(k) && !rescue.includes(k));

    return {
      primary, primaryClass: primaryCls, favor, avoid, rescue, neutral,
      likeG: pref.like, dislikeG: pref.dislike, ge, strong, why,
      weight: (el) => favorWeight({ favor, avoid, rescue }, el),
      // 兼容旧调用点
      yin, shi: D.SHENG[dmwx], cai: D.KE[dmwx],
      guan: Object.keys(D.KE).find((k) => D.KE[k] === dmwx)
    };
  }

  // 五行相对日主属于哪一个十神大类
  function elClass(dmwx, el) {
    if (el === dmwx) return "比劫";
    if (el === D.SHENG[dmwx]) return "食伤";
    if (el === D.KE[dmwx]) return "财";
    if (D.KE[el] === dmwx) return "官杀";
    return "印";
  }

  // 扶抑派粗判：只供整体评分里「身强用财官」那一句使用。
  // 整体分与分位数表是按这一套标定的，换成格局用神会让所有人的分数一起漂移，
  // 所以刻意与流年所用的 usefulElements 分开。
  function strengthUseful(c) {
    // 与流年同一套用神。旧版这里另有一套「身强喜财官食伤全上」，
    // 于是页面写「喜水木」、评分却按「喜水木火」算，两套标准互相打架。
    const u = usefulElements(c);
    if (u && u.favor && u.favor.length) {
      return { favor: u.favor.slice(), avoid: u.avoid.slice(), strong: u.strong,
               primary: u.primary, primaryClass: u.primaryClass };
    }
    const dmwx = c.dayMasterWx;
    const yin = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
    const shi = D.SHENG[dmwx], cai = D.KE[dmwx];
    const guan = Object.keys(D.KE).find((k) => D.KE[k] === dmwx);
    return c.strength >= 50
      ? { favor: [shi, cai, guan], avoid: [dmwx, yin], strong: true }
      : { favor: [yin, dmwx], avoid: [cai, guan, shi], strong: false };
  }


  function band(s) {
    // 阈值按实际分布的分位数定；旧的 80/68/58/46 把七成年份塞进「平」和
    // 「小吉」，画出来的线几乎是平的 —— 不是命平，是刻度坏了。
    return s >= 72 ? "大吉" : s >= 63 ? "吉" : s >= 55 ? "小吉" : s >= 45 ? "平"
      : s >= 40 ? "小凶" : s >= 35 ? "偏弱" : "凶";
  }
  const THEME_MAP = D.THEME_MAP;
  const T = (zh, en) => ({ zh, en });
  const IS_WEAK = (n) => /断点|断绝|偏枯/.test(typeof n === "string" ? n : n.zh);

  const AUSPICIOUS = { 正财: 1, 正印: 1, 正官: 1, 食神: 1 };
  const OMINOUS = { 伤官: 1, 七杀: 1, 劫财: 1, 偏印: 1 };

  // 十神吉凶：五行喜忌打底，格局喜忌修正。
  // 正官格见伤官是破格，伤官格见伤官却是驾御 —— 固定吉神表在这一条上必错。
  function tenGodScore(god, ue, elFavor, elAvoid) {
    // elFavor 收 0–1 的权重；布尔 true 按 1.0。次喜（0.40）不该与用神同分。
    const w = elFavor === true ? 1 : (elFavor === false || elFavor == null ? 0 : Number(elFavor));
    // 五行方向只给 ±2：它已经被「用神」项算过一次，再按 ±5 算一遍
    // 等于同一件事罚两遍，两项叠加直接把总分压到下限
    let base = w > 0 ? 2 * w : (elAvoid ? -2 : 0);
    if ((ue.likeG || []).includes(god)) base += 2.5;
    if ((ue.dislikeG || []).includes(god)) base -= 3;
    return base;
  }

  // 被作用之支（命局某柱）是喜是忌：+1 去病、-1 伤用、0 闲神
  function relSign(ue, zhi) {
    const el = D.ZHI_WUXING[D.ZHI.indexOf(zhi)];
    if (ue.favor.includes(el)) return -1;
    if (ue.avoid.includes(el)) return 1;
    return 0;
  }

  const POSN_EN = { 年: "Year", 月: "Month", 日: "Day", 时: "Hour" };
  const REL_EN = { 六合: "combines with", 六冲: "clashes", 相刑: "punishes",
    相害: "harms", 相破: "breaks", 伏吟: "doubles", 自刑: "self-punishes",
    天干五合: "stem-combines with", 天干相冲: "stem-clashes with" };

  /* 流年/流月评分 —— 顺序依《子平真诠》：
       1 先看喜忌（地支为主） 2 再看十神（吉神/凶神×格局）
       3 后看会合刑冲（冲合要分喜忌） 4 再叠大运基调 5 神煞仅作辅助 */
  function evaluatePeriod(c, gan, zhi, luckCyc) {
    const dm = c.dayMaster;
    const [zhiWxEff, , mergeShare] = zhiEffective(c, zhi);
    const ssG = shishen(dm, gan), ssZ = shishen(dm, REP_GAN[zhiWxEff]);
    const ue = usefulElements(c);
    const favor = ue.favor, avoid = ue.avoid;
    const comp = {};

    const add = elementOf(gan, zhi, mergeShare > 0 ? zhiWxEff : null);
    const es = c.elementScores;
    let gain = 0, loss = 0;
    Object.keys(add).forEach((el) => {
      const v = add[el];
      if (v <= 0) return;
      // 用神本身重于相神；闲神不参与，才有「平年」
      // 用神 1.0 → 2.0，第一相神 0.65 → 1.3，次喜 0.40 → 0.8；忌神 -1。
      // 旧版只看「在不在 favor 里」，三喜的盘等于三个满分。
      const w = favorWeight(ue, el);
      if (w > 0) gain += v * 2.0 * w;
      else if (w < 0) {
        // 忌神有制则不凶：局中有克它或泄它的五行且有力时，惩罚折半
        const ctrl = Object.keys(D.KE).find((k) => D.KE[k] === el);
        const drain = D.SHENG[el];
        const checked = Math.max(es[ctrl] || 0, es[drain] || 0);
        loss += v * (checked >= 5.5 ? 0.7 : 1.6);
      }
    });
    comp["用神"] = Math.round(Math.max(-20, Math.min(20, (gain - loss) * 10)) * 10) / 10;
    comp["忌神有制"] = loss < Object.keys(add).filter((e) => avoid.includes(e))
      .reduce((n, e) => n + add[e] * 1.6, 0) ? 1 : 0;

    const elGan = GWX_MAP[gan], elZhi = zhiWxEff;
    const gwG = favorWeight(ue, elGan), gwZ = favorWeight(ue, elZhi);
    comp["十神"] = Math.round((tenGodScore(ssG, ue, gwG, gwG < 0) * 0.45
      + tenGodScore(ssZ, ue, gwZ, gwZ < 0) * 0.65) * 10) / 10;

    const rels = [];
    // 关系文本是拼出来的，展示层没法事后翻译，所以这里同时出一份英文
    const relsEn = [];
    let delta = 0;
    const POSW = { year: 0.9, month: 1.1, day: 1.4, hour: 0.8 };
    const POSN = { year: "年", month: "月", day: "日", hour: "时" };
    const POS_OF = { 0: "year", 1: "month", 2: "day", 3: "hour" };
    const REL_KIND_EN = { 三会: "three-meeting", 三合: "trine", 半合: "half trine",
      拱合: "arch", 六合: "six-harmony", 三刑: "triple punishment",
      相刑: "punishment", 自刑: "self-punishment", 六害: "harm",
      六破: "destruction", 六冲: "clash" };

    // 三会/半会、三刑、争合、入墓全部交给 relations 判，
    // 这里只负责把「强度 × 柱位 × 喜忌」折成分数。
    const relModel = relSettle(relAnalyse(c, zhi), c);
    const nodeOf = {};
    relModel.nodes.forEach(([i, z]) => { nodeOf[i] = z; });
    const sideOf = (i) => {
      const m = relModel.merged[i];
      const el = m ? m[0] : D.ZHI_WUXING[D.ZHI.indexOf(nodeOf[i])];
      return favor.indexOf(el) >= 0 ? 1 : (avoid.indexOf(el) >= 0 ? -1 : 0);
    };

    relModel.items.forEach((r) => {
      if (r.pos.indexOf(4) < 0) return;
      const others = r.pos.filter((i) => i < 4);
      if (!others.length) return;
      const w = Math.max.apply(null, others.map((i) => POSW[POS_OF[i]]));
      const k = Math.min(1.6, r.strength / (REL_BASE[r.kind] || 1));
      const sign = others.reduce((a, i) => a + sideOf(i), 0) / others.length;
      const whereZh = others.map((i) => POSN[POS_OF[i]]).join("/");
      const whereEn = others.map((i) => POSN_EN[POSN[POS_OF[i]]]).join("/");
      const bodyZh = r.zhis.join("");
      const bodyEn = r.zhis.map((z) => py(z)).join(" ");

      if (r.kind === "六冲") {
        const base = sign > 0 ? 4.5 : (sign < 0 ? -6.5 : -1.5);
        delta += base * k * w;
        rels.push(`${whereZh}支${bodyZh}六冲`);
        relsEn.push(`${whereEn} branch ${bodyEn} clashes`);
      } else if (r.kind === "六合") {
        const base = sign > 0 ? 3.2 : (sign < 0 ? -3.0 : 0.6);
        delta += base * k * w;
        rels.push(`${whereZh}支${bodyZh}${r.transforms ? "六合化" + r.element : "六合不化"}`);
        relsEn.push(`${whereEn} branch ${bodyEn} ${r.transforms
          ? "combines into " + r.element : "combines without transforming"}`);
      } else if (["三刑", "相刑", "自刑", "六害", "六破"].indexOf(r.kind) >= 0) {
        const sev = { 三刑: 4.2, 相刑: 2.6, 自刑: 2.2, 六害: 1.6, 六破: 1.3 }[r.kind];
        delta -= sev * k * w;
        rels.push(`${whereZh}支${bodyZh}${r.kind}`);
        relsEn.push(`${whereEn} branch ${bodyEn} — ${REL_KIND_EN[r.kind]}`);
      } else if (["三会", "三合", "半合", "拱合"].indexOf(r.kind) >= 0) {
        const sHua = favor.indexOf(r.element) >= 0 ? 1
          : (avoid.indexOf(r.element) >= 0 ? -1 : 0);
        const amt = sHua > 0 ? 2.0 : sHua < 0 ? -2.0 : 0.8;
        delta += amt * k * (r.transforms ? 1.0 : 0.4);
        rels.push(relLabel(r));
        relsEn.push(`${bodyEn} ${REL_KIND_EN[r.kind]} ${r.transforms
          ? "transforms into " + r.element : "does not transform"}`);
      }
    });

    // 伏吟：流年支与命局某支相同（辰午酉亥的自刑已由 relations 给出）
    c.pillars.forEach((p) => {
      if (p.zhi === zhi && D.SELF_XING.indexOf(zhi) < 0) {
        delta -= 2.0 * POSW[p.position];
        rels.push(`流年${zhi}伏吟${POSN[p.position]}支`);
        relsEn.push(`the year doubles the ${POSN_EN[POSN[p.position]]} branch`);
      }
    });

    // 墓库：用神入墓则失其用，冲开库则所藏之物出得来
    relModel.nodes.forEach((pair) => {
      const i = pair[0], z = pair[1];
      if (!(z in D.TOMB)) return;
      const stored = D.TOMB[z];
      if (i < 4 && D.CHONG[zhi] === z) {
        if (favor.indexOf(stored) >= 0) {
          delta += 3.2;
          rels.push(`冲开${z}库，${stored}得出`);
          relsEn.push(`the clash opens the ${z} storehouse, releasing ${stored}`);
        } else if (avoid.indexOf(stored) >= 0) {
          delta -= 2.4;
          rels.push(`冲开${z}库，${stored}忌神出`);
          relsEn.push(`the clash opens the ${z} storehouse, releasing a hostile ${stored}`);
        }
      } else if (i === 4 && favor.indexOf(stored) >= 0) {
        delta -= 2.6;
        rels.push(`流年${zhi}为${stored}之墓`);
        relsEn.push(`${py(zhi)} is the tomb of ${stored}`);
      } else if (i === 4 && avoid.indexOf(stored) >= 0) {
        delta += 1.8;
        rels.push(`流年${zhi}收${stored}入墓`);
        relsEn.push(`${py(zhi)} buries the hostile ${stored}`);
      }
    });

    // 天干：运/年干只与命局四干论，模型里没有它的位置
    c.pillars.forEach((p) => {
      const pos = POSN[p.position], w = POSW[p.position];
      const elP = GWX_MAP[p.gan];
      const sGan = avoid.includes(elP) ? 1 : (favor.includes(elP) ? -1 : 0);
      ganRels(p.gan, gan).forEach((r) => {
        rels.push(`${pos}干${p.gan}与${gan}${r}`);
        relsEn.push(`${POSN_EN[pos]} stem ${py(p.gan)} ${REL_EN[r] || r} ${py(gan)}`);
        if (r === "天干相冲") delta += (sGan > 0 ? 3.0 : sGan < 0 ? -4.0 : -1.0) * w;
        else if (r === "天干五合") delta += (sGan > 0 ? 2.2 : sGan < 0 ? -2.2 : 0.6) * w;
      });
      if (D.GAN_CHONG[p.gan] === gan && D.CHONG[p.zhi] === zhi) {
        rels.push(`与${pos}柱天克地冲`);
        relsEn.push(`stem-and-branch clash with the ${POSN_EN[pos]} pillar`);
        const sign = sideOf(c.pillars.indexOf(p));
        if (sign > 0 && sGan > 0) delta += 5.0 * w;
        else if (sign < 0 || sGan < 0) delta -= 8.0 * w;
        else delta -= 3.0 * w;
      }
    });
    comp["冲合"] = Math.round(Math.max(-12, Math.min(12, delta)) * 10) / 10;

    let tone = 0, big = 0;
    if (luckCyc) {
      // 天干主外、地支主内，四六开
      const eLg = GWX_MAP[luckCyc.gan];
      // 大运地支同样进原局论合化：一部运的寅，落在午戌俱全的局里是火不是木
      const eLz = zhiEffective(c, luckCyc.zhi)[0];
      const sLg = favor.includes(eLg) ? 1 : (avoid.includes(eLg) ? -1 : 0);
      const sLz = favor.includes(eLz) ? 1 : (avoid.includes(eLz) ? -1 : 0);
      tone = Math.max(-1, Math.min(1, sLg * 0.4 + sLz * 0.6));
      // 大运基调不再直接砸 ±9 分：下面「大运吉而流年凶」那段已经用同一个
      // tone 往 50 拉过一次，两处都按 9 分算等于同一件事罚两遍
      big = tone * 3;
      const lGod = shishen(dm, luckCyc.gan);
      const lZGod = shishen(dm, REP_GAN[eLz]);
      if (ue.dislikeG.includes(lGod) || ue.dislikeG.includes(lZGod)) {
        big -= 3;
        rels.push(`大运${lGod}/${lZGod}为格局所忌`);
        relsEn.push(`decade ${D.I18N.shishen[lGod] || lGod}/${D.I18N.shishen[lZGod] || lZGod} is what the structure dislikes`);
      }
      if (D.GAN_CHONG[luckCyc.gan] === gan && D.CHONG[luckCyc.zhi] === zhi) {
        big -= 6; rels.push("大运流年天克地冲");
        relsEn.push("decade and year clash on both stem and branch");
      }
      if (zhi === luckCyc.zhi) { big -= 2; rels.push("流年伏吟大运"); relsEn.push("year doubles the decade"); }
      else if (D.CHONG[luckCyc.zhi] === zhi) { big -= 1.5; rels.push("流年冲大运"); relsEn.push("year clashes the decade"); }
    }
    comp["大运"] = Math.round(big * 10) / 10;

    let sha = 0;
    if ((D.TIANYI[dm] || "").includes(zhi)) { sha += 4; rels.push("流年天乙贵人"); relsEn.push("Tian Yi (noble) in the year"); }
    if (D.WENCHANG[dm] === zhi) { sha += 3; rels.push("流年文昌"); relsEn.push("Wen Chang (scholarship) in the year"); }
    if (D.LU[dm] === zhi) { sha += 3; rels.push("流年临禄"); relsEn.push("Lu (salary) in the year"); }
    if (["辰", "戌", "丑", "未"].includes(zhi) && (ssZ === "正官" || ssZ === "七杀")) sha -= 2;
    comp["神煞"] = sha;

    let raw = 50 + comp["用神"] + comp["十神"] + comp["冲合"] + comp["大运"] + comp["神煞"];
    // 大运吉而流年凶 → 不至大凶；大运凶而流年吉 → 吉力打折
    if (tone > 0 && raw < 50) raw = 50 - (50 - raw) * (1 - 0.42 * tone);
    else if (tone < 0 && raw > 50) raw = 50 + (raw - 50) * (1 - 0.42 * Math.abs(tone));

    // 收窄到 32–94：单年读数是「倾向」不是「判决」；0.72 会把标准差一起压掉
    let score = 50 + (Math.max(0, Math.min(100, raw)) - 50) * 0.80;
    score = Math.max(30, Math.min(93, score));
    comp["base"] = 50;
    comp["raw"] = Math.round(raw * 10) / 10;
    comp["大运基调"] = Math.round(tone * 100) / 100;

    const themes = [...new Set([...(THEME_MAP[ssG] || []), ...(THEME_MAP[ssZ] || [])])];
    const cautions = [], opps = [];
    rels.forEach((r) => {
      if (r.includes("六冲") && r.includes("日")) cautions.push(T("日支被冲：住所、婚姻或自身状态易有变动，忌仓促决定", "Day branch clashed: home, marriage or your own state shifts — avoid hasty decisions"));
      else if (r.includes("六冲") && r.includes("月")) cautions.push(T("月柱被冲：工作环境或家庭结构面临调整", "Month pillar clashed: work environment or family structure adjusts"));
      else if (r.includes("六冲") && r.includes("年")) cautions.push(T("年柱被冲：长辈、根基或长期规划受扰", "Year pillar clashed: elders, foundations or long plans are disturbed"));
      else if (r.includes("六冲") && r.includes("时")) cautions.push(T("时柱被冲：子女、下属或投资标的易有变动", "Hour pillar clashed: children, staff or investments shift"));
      else if (r.includes("天克地冲")) cautions.push(T("天克地冲：该领域阻力最大，宜守不宜攻", "Stem-and-branch clash: the strongest headwind — hold, do not attack"));
      else if (r.includes("相刑")) cautions.push(T("相刑：易生是非、官非或健康小疾，注意契约与口舌", "Punishment: disputes, legal friction or minor illness"));
      else if (r.includes("相害")) cautions.push(T("相害：人际暗耗，慎防被牵连", "Harm: quiet attrition in relationships"));
      else if (r.includes("伏吟")) cautions.push(T("伏吟：旧事重来，情绪反复，宜静守", "Repetition: old matters return, mood swings"));
    });
    if (OMINOUS[ssG] && score < 48) cautions.push(T(`${ssG}当值而全局失衡：压力与是非集中，忌硬碰体制与上级`, `${D.I18N.shishen[ssG] || ssG} rules an unbalanced period: pressure concentrates — do not fight authority`));
    if (AUSPICIOUS[ssG] && score >= 55) cautions.push(T("吉神当值，宜按程序推进，勿走捷径以免失信", "A benefic rules: proceed by procedure, do not cut corners"));

    if (score >= 62) opps.push(T(`${ssG}/${ssZ}得用，是推进主业与积累信誉的窗口`, `${D.I18N.shishen[ssG] || ssG}/${D.I18N.shishen[ssZ] || ssZ} are useful: a window to push your main line`));
    const joined = rels.join(" ");
    if (joined.includes("天乙贵人")) opps.push(T("天乙贵人到位：主动求见关键人物，成功率高", "Tian Yi present: approach key people proactively"));
    if (joined.includes("文昌")) opps.push(T("文昌到位：考试、论文、资格与公开发表皆宜", "Wen Chang present: exams, papers, credentials"));
    if (joined.includes("临禄")) opps.push(T("临禄：正财与职位稳固，适合谈薪与升迁", "Lu present: salary and position steady"));
    if (comp["用神"] >= 12) opps.push(T(`喜用${favor.join("")}当令，资源顺势而来，宜进取`, `Favourable elements in season: resources come with the flow`));
    if (joined.includes("三合") || joined.includes("半合")) opps.push(T("成合局：宜合作、宜结盟，借他人之力成事", "A combination forms: ally with others"));

    // cautions 是 {zh,en} 对象，按引用去重不会生效，必须按中文文本去重
    const uniq = (arr) => {
      const seen = new Set(), o = [];
      arr.forEach((x) => {
        const k = typeof x === "string" ? x : x.zh;
        if (!seen.has(k)) { seen.add(k); o.push(x); }
      });
      return o;
    };
    return { shishenGan: ssG, shishenZhi: ssZ, score: Math.round(score * 10) / 10,
      band: band(Math.round(score * 10) / 10), components: comp, relations: rels,
      themes, relationsEn: relsEn, cautions: uniq(cautions), opportunities: uniq(opps),
      // 相对位置：分数本身没有绝对含义，这个才是能说出口的那句话
      percentile: yearPercentileOf(score),
      merge: { wx: zhiWxEff, note: (zhiEffective(c, zhi)[1] || ""), share: mergeShare,
               god: mergeShare > 0 ? ssZ : "", gan: ssG } };
  }

  function yearPeriod(c, year, luckCyc) {
    const idx = mod(year - 4, 60), g = GAN[idx % 10], z = ZHI[idx % 12];
    const ev = evaluatePeriod(c, g, z, luckCyc);
    const s = fromJD(termLocal(year, "立春")), e = fromJD(termLocal(year + 1, "立春"));
    return Object.assign({ kind: "year", name: String(year), label: g + z, gan: g, zhi: z,
      start: `${s[0]}-${String(s[1]).padStart(2, "0")}-${String(s[2]).padStart(2, "0")}`,
      end: `${e[0]}-${String(e[1]).padStart(2, "0")}-${String(e[2]).padStart(2, "0")}`,
      luckCycle: luckCyc ? luckCyc.label : "", age: year - c.birth.y + 1 }, ev);
  }
  function monthPeriods(c, year, luckCyc) {
    const order = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒"];
    const zhis = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
    const yg = GAN[mod(year - 4, 10)];
    const first = TIGER[gi(yg)];
    const out = [];
    // 流年基调：流月是「节奏」，流年是「主题」，月份必须围绕年走
    const base = evaluatePeriod(c, yg, D.ZHI[mod(year - 4, 12)], luckCyc);
    order.forEach((nm, k) => {
      const yy = nm === "小寒" ? year + 1 : year;
      const start = termLocal(yy, nm);
      const nxt = k + 1 < 12 ? termLocal(yy, order[k + 1]) : termLocal(year + 1, "立春");
      const g = GAN[mod(first + k, 10)], z = zhis[k];
      const ev = evaluatePeriod(c, g, z, luckCyc);
      const s = fromJD(start), e = fromJD(nxt);
      out.push(Object.assign({ kind: "month", name: `${s[0]}-${String(s[1]).padStart(2, "0")}`,
        label: g + z, gan: g, zhi: z,
        start: `${s[0]}-${String(s[1]).padStart(2, "0")}-${String(s[2]).padStart(2, "0")}`,
        end: `${e[0]}-${String(e[1]).padStart(2, "0")}-${String(e[2]).padStart(2, "0")}` }, ev,
        { score: Math.round((base.score + (ev.score - base.score) * 0.55) * 10) / 10 }));
    });
    out.forEach((p) => { p.band = band(p.score); });
    return out;
  }

  /* ---------------- ziwei ---------------- */
  const PAL = D.PALACE_NAMES, PAL_EN = D.PALACE_EN;
  const ZSTAR_EN = D.STAR_EN;

  function buildZiwei(o) {
    const jd = toJD(o.y, o.m, o.d, o.h, o.mi);
    let ts = { h: o.h, mi: o.mi }, jdT = jd;
    if (o.trueSolar !== false) {
      const off = trueSolarOffset(jd, o.lon, o.tz === undefined ? 8 : o.tz);
      const base = new Date(Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi));
      const nd = new Date(base.getTime() + off * 60000);
      ts = { h: nd.getUTCHours(), mi: nd.getUTCMinutes() };
      jdT = toJD(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate(), ts.h, ts.mi, nd.getUTCSeconds());
    }
    const ld = lunarFromJD(jd);
    const hidx = zi(hourBranchOf(ts.h + ts.mi / 60));
    const ygLunar = o.yearBoundary === "lichun" ? yearPillar(jd)[0] : GAN[mod(ld.year - 4, 10)];
    const yzLunar = ZHI[mod(ld.year - 4, 12)];
    const yi = gi(ygLunar), yiz = zi(yzLunar);
    let mnum = ld.month;
    if (ld.isLeap) {
      if ((o.leapPolicy || "split") === "split") mnum = ld.day <= 15 ? ld.month : ld.month + 1;
      else if (o.leapPolicy === "next") mnum = ld.month + 1;
    }
    mnum = mod(mnum - 1, 12) + 1;
    const mi = mnum - 1;
    const ming = mod(2 + mi - hidx, 12);
    const shen = mod(2 + mi + hidx, 12);
    const soulS = mod(ming - 2, 12), bodyS = mod(shen - 2, 12);
    const first = TIGER[yi];
    const gans = [];
    for (let i = 0; i < 12; i++) gans.push(GAN[mod(first + i, 10)]);
    const mingGan = gans[mod(ming - 2, 12)];
    const ny = nayin(mingGan, ZHI[ming]);
    const juWx = ny[ny.length - 1];
    const [juNum, juName] = D.JU[juWx];
    let offset = 0;
    while ((ld.day + offset) % juNum) offset++;
    const q = (ld.day + offset) / juNum;
    let iz = mod(q, 12) - 1;
    iz += offset % 2 === 0 ? offset : -offset;
    const ziIdx = mod(iz + 2, 12);
    const fuIdx = mod(4 - ziIdx, 12);
    const pos = { "紫微": ziIdx };
    [[-1, "天机"], [-3, "太阳"], [-4, "武曲"], [-5, "天同"], [-8, "廉贞"]].forEach(([off, nm]) => { pos[nm] = mod(ziIdx + off, 12); });
    [[0, "天府"], [1, "太阴"], [2, "贪狼"], [3, "巨门"], [4, "天相"], [5, "天梁"], [6, "七杀"], [10, "破军"]].forEach(([off, nm]) => { pos[nm] = mod(fuIdx + off, 12); });
    pos["左辅"] = mod(4 + mi, 12);
    pos["右弼"] = mod(10 - mi, 12);
    pos["文昌"] = mod(10 - hidx, 12);
    pos["文曲"] = mod(4 + hidx, 12);
    const [kui, yue] = D.KUI_YUE[ygLunar];
    pos["天魁"] = zi(kui); pos["天钺"] = zi(yue);
    const lu = zi(D.LUCUN[ygLunar]);
    pos["禄存"] = lu; pos["擎羊"] = mod(lu + 1, 12); pos["陀罗"] = mod(lu - 1, 12);
    pos["火星"] = mod(zi(D.HUOXING_START[yzLunar]) + hidx, 12);
    pos["铃星"] = mod(zi(D.LINGXING_START[yzLunar]) + hidx, 12);
    pos["地空"] = mod(11 - hidx, 12); pos["地劫"] = mod(11 + hidx, 12);
    pos["天马"] = zi(D.YIMA[yzLunar]);
    // 38 杂曜
    pos["天姚"] = mod(1 + mi, 12);
    pos["天刑"] = mod(9 + mi, 12);
    pos["阴煞"] = zi(["寅", "子", "戌", "申", "午", "辰"][mi % 6]);
    pos["天月"] = zi(["戌", "巳", "辰", "寅", "未", "卯", "亥", "未", "寅", "午", "戌", "寅"][mi]);
    pos["天巫"] = zi(["巳", "申", "寅", "亥"][mi % 4]);
    pos["解神"] = zi(["申", "戌", "子", "寅", "辰", "午"][Math.floor(mi / 2)]);
    const hong = mod(3 - yiz, 12);
    pos["红鸾"] = hong; pos["天喜"] = mod(hong + 6, 12);
    pos["咸池"] = zi({ 申: "酉", 子: "酉", 辰: "酉", 寅: "卯", 午: "卯", 戌: "卯", 巳: "午", 酉: "午", 丑: "午", 亥: "子", 卯: "子", 未: "子" }[yzLunar]);
    pos["华盖"] = zi({ 申: "辰", 子: "辰", 辰: "辰", 寅: "戌", 午: "戌", 戌: "戌", 巳: "丑", 酉: "丑", 丑: "丑", 亥: "未", 卯: "未", 未: "未" }[yzLunar]);
    const GU = { 0: ["寅", "戌"], 1: ["寅", "戌"], 2: ["巳", "丑"], 3: ["巳", "丑"], 4: ["巳", "丑"], 5: ["申", "辰"], 6: ["申", "辰"], 7: ["申", "辰"], 8: ["亥", "未"], 9: ["亥", "未"], 10: ["亥", "未"], 11: ["寅", "戌"] };
    pos["孤辰"] = zi(GU[yiz][0]); pos["寡宿"] = zi(GU[yiz][1]);
    pos["破碎"] = zi(["巳", "丑", "酉"][yiz % 3]);
    pos["蜚廉"] = zi(["申", "酉", "戌", "巳", "午", "未", "寅", "卯", "辰", "亥", "子", "丑"][yiz]);
    pos["龙池"] = mod(4 + yiz, 12); pos["凤阁"] = mod(10 - yiz, 12);
    pos["天哭"] = mod(6 - yiz, 12); pos["天虚"] = mod(6 + yiz, 12);
    pos["天官"] = zi(["未", "辰", "巳", "寅", "卯", "酉", "亥", "酉", "戌", "午"][yi]);
    pos["天福"] = zi(["酉", "申", "子", "亥", "卯", "寅", "午", "巳", "午", "巳"][yi]);
    pos["天厨"] = zi(["巳", "午", "子", "巳", "午", "申", "寅", "午", "酉", "亥"][yi]);
    pos["天德"] = mod(9 + yiz, 12); pos["月德"] = mod(5 + yiz, 12);
    pos["天空"] = mod(yiz + 1, 12);
    pos["截路"] = zi(["申", "午", "辰", "寅", "子"][yi % 5]);
    pos["空亡"] = zi(["酉", "未", "巳", "卯", "丑"][yi % 5]);
    let xun = mod(yiz + 9 - yi + 1, 12);
    if ((yiz % 2) !== (xun % 2)) xun = mod(xun + 1, 12);
    pos["旬空"] = xun;
    pos["年解"] = zi(["戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"][yiz]);
    pos["天才"] = mod(soulS + yiz + 2, 12);
    pos["天寿"] = mod(bodyS + yiz + 2, 12);
    pos["台辅"] = mod(6 + hidx, 12); pos["封诰"] = mod(2 + hidx, 12);
    const dayIdx = ld.day - 1;
    pos["三台"] = mod(pos["左辅"] + dayIdx, 12);
    pos["八座"] = mod(pos["右弼"] - dayIdx, 12);
    pos["恩光"] = mod(mod(pos["文昌"] + dayIdx, 12) - 1, 12);
    pos["天贵"] = mod(mod(pos["文曲"] + dayIdx, 12) - 1, 12);
    pos["天伤"] = mod(soulS - 7 + 2, 12);
    pos["天使"] = mod(soulS - 5 + 2, 12);

    const tbl = (o.sihuaSchool === "feixing") ? D.SIHUA_FEIXING : D.SIHUA_SANHE;
    const huaMap = {};
    tbl[ygLunar].forEach((st, i) => { huaMap[st] = ["禄", "权", "科", "忌"][i]; });
    const chart = { name: o.name || "", gender: o.gender, birth: { y: o.y, m: o.m, d: o.d },
      lunar: ld, hourBranch: ZHI[hidx], mingBranch: ZHI[ming], shenBranch: ZHI[shen],
      ju: juName, juNum, ziweiBranch: ZHI[ziIdx], yearGan: ygLunar, yearZhi: yzLunar,
      mingZhu: D.MING_ZHU[ZHI[ming]], shenZhu: D.SHEN_ZHU[yzLunar],
      douJun: ZHI[mod(yiz - mi + hidx, 12)], palaces: [] };
    const yang = yiz % 2 === 0, male = ["male", "男", "m"].includes(o.gender);
    const forward = (yang === male);
    chart.decadeDirection = forward ? 1 : -1;
    const CS = D.CHANGSHENG12, BS = D.BOSHI12, JQ = D.JIANGQIAN12, SQ = D.SUIQIAN12;
    const csStart = zi(D.CHANGSHENG_START[juName[0]]);
    const cs = {}, bs = {};
    for (let i = 0; i < 12; i++) {
      cs[forward ? mod(csStart + i, 12) : mod(csStart - i, 12)] = CS[i];
      bs[forward ? mod(lu + i, 12) : mod(lu - i, 12)] = BS[i];
    }
    const jqStart = zi({ 寅: "午", 午: "午", 戌: "午", 申: "子", 子: "子", 辰: "子", 巳: "酉", 酉: "酉", 丑: "酉", 亥: "卯", 卯: "卯", 未: "卯" }[yzLunar]);
    const jq = {}, sq = {};
    for (let i = 0; i < 12; i++) { jq[mod(jqStart + i, 12)] = JQ[i]; sq[mod(yiz + i, 12)] = SQ[i]; }
    const xxStart = zi(D.XIAOXIAN_START[yzLunar]);
    const agesBy = {};
    for (let k = 0; k < 12; k++) {
      const b = male ? mod(xxStart + k, 12) : mod(xxStart - k, 12);
      const arr = []; for (let a = k + 1; a <= 120; a += 12) arr.push(a);
      agesBy[b] = arr;
    }
    for (let k = 0; k < 12; k++) {
      const idx = mod(ming - k, 12);
      const stars = [];
      Object.keys(pos).forEach((nm) => {
        if (pos[nm] !== idx) return;
        const kind = D.MAJOR_STARS.includes(nm) ? "主星" : D.LUCKY.includes(nm) ? "辅星" : D.UNLUCKY.includes(nm) ? "煞星" : "杂曜";
        stars.push({ name: nm, nameEn: (ZSTAR_EN || {})[nm] || nm, kind, hua: huaMap[nm] || "",
          brightness: (D.BRIGHTNESS[nm] || {})[ZHI[idx]] || "" });
      });
      const ord = { 主星: 0, 辅星: 1, 煞星: 2, 杂曜: 3 };
      stars.sort((a, b) => (ord[a.kind] - ord[b.kind]) || (D.MAJOR_STARS.indexOf(a.name) - D.MAJOR_STARS.indexOf(b.name)));
      const ganHere = gans[mod(idx - 2, 12)];
      const selfTbl = {};
      tbl[ganHere].forEach((st, i) => { selfTbl[st] = ["禄", "权", "科", "忌"][i]; });
      const selfHua = stars.filter((s) => selfTbl[s.name]).map((s) => [s.name, selfTbl[s.name]]);
      const k2 = forward ? mod(idx - ming, 12) : mod(ming - idx, 12);
      chart.palaces.push({ branch: ZHI[idx], index: idx, name: PAL[k], nameEn: PAL_EN[k],
        gan: ganHere, stars, isBody: idx === shen,
        changsheng: cs[idx] || "", boshi: bs[idx] || "",
        jiangqian: jq[idx] || "", suiqian: sq[idx] || "",
        ages: agesBy[idx] || [], selfHua,
        decade: [juNum + k2 * 10, juNum + k2 * 10 + 9] });
    }
    chart.sihua = huaMap;
    return chart;
  }

  const OPP = 6;
  function palaceScore(chart, palace) {
    const trio = [palace];
    [-4, 4, OPP].forEach((off) => chart.palaces.forEach((p) => { if (p.index === mod(palace.index + off, 12)) trio.push(p); }));
    const comp = { main: 0, lucky: 0, unlucky: 0, hua: 0 };
    trio.forEach((p) => {
      const w = p === palace ? 1 : 0.55;
      p.stars.forEach((s) => {
        if (s.kind === "主星") comp.main += (D.BRIGHT_SCORE[s.brightness] || 0) * w;
        else if (D.LUCKY.includes(s.name)) comp.lucky += 1.6 * w;
        else if (D.UNLUCKY.includes(s.name)) comp.unlucky += 2 * w;
        if (s.hua === "禄") comp.hua += 2 * w;
        else if (s.hua === "权") comp.hua += 1.2 * w;
        else if (s.hua === "科") comp.hua += 1.4 * w;
        else if (s.hua === "忌") comp.hua -= 2.4 * w;
      });
    });
    const raw = comp.main + comp.lucky - comp.unlucky + comp.hua;
    return Math.round(Math.max(2, Math.min(98, 50 + raw * 5.2)) * 10) / 10;
  }
    /* 紫微格局全表 —— 与 mingli/ziwei/patterns.py 逐条对应。
     54 条：吉 37 / 中 4 / 凶 13。旧版拿繁体星名（破軍/貪狼/天機）去比简体
     星曜表，十条里七条永不命中；而且只返回命中的，看不到「差一点」的那些。
     现在全返回：成立带依据，成立但有瑕疵的带 flaw，不成立的带 why（可核对）。 */
  function detectPatterns(chart) {
    const PAL = {};
    chart.palaces.forEach((p) => { PAL[p.index] = p; });
    const ming = chart.palaces.find((p) => p.name === "命宫");
    const shen = chart.palaces.find((p) => p.isBody) || null;
    const starSet = (p) => new Set(p.stars.map((s) => s.name));
    const majorSet = (p) => new Set(p.stars.filter((s) => s.kind === "主星").map((s) => s.name));
    const huaOf = (p) => { const o = {}; p.stars.forEach((s) => { if (s.hua) o[s.name] = s.hua; }); return o; };
    const trio = [ming.index].concat([-4, 4, 6].map((o) => mod(ming.index + o, 12))).map((i) => PAL[i]);
    const trioStars = new Set(), trioMajors = new Set(), trioHua = {};
    trio.forEach((p) => {
      starSet(p).forEach((x) => trioStars.add(x));
      majorSet(p).forEach((x) => trioMajors.add(x));
      Object.assign(trioHua, huaOf(p));
    });
    const ms = starSet(ming), mm = majorSet(ming);
    const BALEFUL = ["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"];
    const badHere = BALEFUL.filter((s) => trioStars.has(s));
    const jiHere = Object.keys(trioHua).some((k) => trioHua[k] === "忌");

    const flank = (idx) => [PAL[mod(idx - 1, 12)], PAL[mod(idx + 1, 12)]];
    const flanked = (idx, a, b) => {
      const lr = flank(idx), sl = starSet(lr[0]), sr = starSet(lr[1]);
      return (sl.has(a) && sr.has(b)) || (sl.has(b) && sr.has(a));
    };
    const brightOf = (star) => {
      for (const p of trio) for (const s of p.stars) if (s.name === star) return s.brightness || "";
      return "";
    };
    const mingHas = (star) => mm.has(star);
    const mingPair = (a, b) => mm.has(a) && mm.has(b);
    // 同宫或对拱；默认只在命宫三方四正内 —— 火在官禄、贪狼在夫妻同属对宫，
    // 但没会到命，旧版就是这样误判出火贪格的
    const sameOrOpp = (star, star2, hua) => {
      for (const p of trio) {
        const na = starSet(p);
        // 先比同宫 —— 禄马同宫最常见，只比「对拱」等于把这条格废掉
        const sameIn = star2 ? na.has(star2)
          : Object.keys(huaOf(p)).some((k) => huaOf(p)[k] === hua);
        if (na.has(star) && sameIn) return true;
        const opp = PAL[mod(p.index + 6, 12)];
        if (trio.indexOf(opp) < 0) continue;
        if (!na.has(star)) continue;
        const nb = starSet(opp);
        const hitB = star2 ? nb.has(star2)
          : Object.keys(huaOf(opp)).some((k) => huaOf(opp)[k] === hua);
        if (hitB) return true;
      }
      return false;
    };
    const where = (star) => {
      let s = star;
      if (s.length === 2 && s[0] === "化") s = s[1];   // 「化禄」与「禄」同一次查询
      if (["禄", "权", "科", "忌"].indexOf(s) >= 0) {
        for (const p of chart.palaces) {
          const owners = Object.keys(huaOf(p)).filter((k) => huaOf(p)[k] === s);
          if (owners.length) return p.name + "（" + owners[0] + "化" + s + "）";
        }
        return "未入盘";
      }
      for (const p of chart.palaces) if (starSet(p).has(s)) return p.name;
      return "未入盘";
    };
    const twoWhere = (a, b) => a + "在" + where(a) + "、" + b + "在" + where(b) + "，两宫不相会";

    const out = [];
    const add = (name, ok, note, strict, why) => {
      const d = D.PATTERNS.find((x) => x[0] === name);
      if (!d) return;
      const tier = d[1];
      let flaw = "";
      if (ok && strict !== false && tier === "吉"
          && (badHere.length >= 2 || (badHere.length > 0 && jiHere))) {
        flaw = badHere.join("、") + (jiHere ? "及化忌" : "") + "同会，成色受损";
      }
      out.push({ name: name, tier: tier, desc: d[2], descEn: d[3],
        status: ok ? "成立" : "不成立",
        note: ok ? (note || "") : "", flaw: flaw, why: ok ? "" : (why || "") });
    };

    // ---------- 紫微系 ----------
    add("紫府同宫", mingPair("紫微", "天府") && (ming.branch === "寅" || ming.branch === "申"),
      "紫微天府同守命宫", true,
      "紫微在" + where("紫微") + "、天府在" + where("天府") + "，不同守命宫或不在寅申");
    add("紫府朝垣", trioMajors.has("紫微") && trioMajors.has("天府") && !mingPair("紫微", "天府"),
      "紫微天府合照三方", true,
      (["紫微", "天府"].some((x) => trioMajors.has(x))
        ? "三方只见" + ["紫微", "天府"].filter((x) => trioMajors.has(x)).join("") + "，紫府未合照"
        : "三方四正不见紫微天府"));
    add("君臣庆会", mingHas("紫微") && ["左辅", "右弼"].some((x) => trioStars.has(x))
      && ["天魁", "天钺"].some((x) => trioStars.has(x)),
      "紫微坐命，辅弼魁钺同会", true,
      !mingHas("紫微") ? "紫微不坐命" : "辅弼魁钺未齐");
    add("极向离明", mingHas("紫微") && ming.branch === "午", "紫微在午", true,
      "紫微不在午宫坐命");
    add("紫府夹命", flanked(ming.index, "紫微", "天府"), "紫微天府夹命", true,
      "命宫两侧无紫微天府");

    // 双星同宫：命宫三方四正之内，两颗主星落在同一宫。
    // 论格以三方四正为准，不要求坐命 —— 与「府相朝垣」同一个道理。
    const pairInTrio = (a, b, branches) => trio.some((p) => {
      const mm2 = majorSet(p);
      return mm2.has(a) && mm2.has(b) && branches.indexOf(p.branch) >= 0;
    });
    [["紫贪同宫", "紫微", "贪狼", ["卯", "酉"]],
     ["紫相同宫", "紫微", "天相", ["辰", "戌"]],
     ["紫杀同宫", "紫微", "七杀", ["巳", "亥"]],
     ["紫破同宫", "紫微", "破军", ["丑", "未"]],
     ["机阴同宫", "天机", "太阴", ["寅", "申"]],
     ["机梁同宫", "天机", "天梁", ["辰", "戌"]],
     ["日月同宫", "太阳", "太阴", ["辰", "戌"]],
     ["阳梁同宫", "太阳", "天梁", ["卯", "酉"]],
     ["武府同宫", "武曲", "天府", ["子", "午"]],
     ["财印交驰", "武曲", "天相", ["寅", "申"]],
     ["武杀同宫", "武曲", "七杀", ["卯", "酉"]],
     ["武破同宫", "武曲", "破军", ["巳", "亥"]],
     ["同阴同宫", "天同", "太阴", ["子", "午"]],
     ["同巨同宫", "天同", "巨门", ["丑", "未"]],
     ["同梁同宫", "天同", "天梁", ["寅", "申"]],
     ["廉府同宫", "廉贞", "天府", ["辰", "戌"]],
     ["廉贪同宫", "廉贞", "贪狼", ["巳", "亥"]],
     ["廉相同宫", "廉贞", "天相", ["子", "午"]],
     ["廉杀同宫", "廉贞", "七杀", ["丑", "未"]],
     ["廉破同宫", "廉贞", "破军", ["卯", "酉"]]]
      .forEach(([nm, a, b, br]) => {
        add(nm, pairInTrio(a, b, br), a + b + "同宫" + br[0] + br[1], true,
          a + "在" + where(a) + "、" + b + "在" + where(b) + "，不同宫或不在" + br[0] + br[1]);
      });

    // ---------- 天府天相系 ----------
    add("府相朝垣", trioMajors.has("天府") && trioMajors.has("天相"), "天府天相会照", true,
      "三方只见" + (["天府", "天相"].filter((x) => trioMajors.has(x)).join("") || "无"));
    add("财荫夹印", xiangFlankedByFuLiang(chart), "天相为天府天梁所夹", true,
      "天相两侧非天府天梁");

    // ---------- 日月系 ----------
    add("日月并明", trioMajors.has("太阳") && trioMajors.has("太阴")
      && ["庙", "旺"].indexOf(brightOf("太阳")) >= 0
      && ["庙", "旺"].indexOf(brightOf("太阴")) >= 0,
      "日月皆旺", true, "日月未同会三方，或亮度不足");
    add("日丽中天", mingHas("太阳") && ming.branch === "午", "太阳在午", true, "太阳不在午宫坐命");
    add("日照雷门", mingHas("太阳") && ming.branch === "卯", "太阳在卯", true, "太阳不在卯宫坐命");
    add("月朗天门", mingHas("太阴") && ming.branch === "亥", "太阴在亥", true, "太阴不在亥宫坐命");
    add("月生沧海", mingHas("太阴") && ming.branch === "子", "太阴在子", true, "太阴不在子宫坐命");
    add("日月夹命", flanked(ming.index, "太阳", "太阴"), "日月夹命", true, "命宫两侧无日月");

    // ---------- 武曲廉贞系 ----------
    add("武曲守垣", mingHas("武曲") && ["辰", "戌", "丑", "未"].indexOf(ming.branch) >= 0,
      "武曲坐命四墓之地", true, "武曲不坐辰戌丑未");
    add("廉贞清白", mingHas("廉贞") && (ming.branch === "寅" || ming.branch === "申"),
      "廉贞在寅申", true, "廉贞不在寅申坐命");
    add("武贪同行", mingPair("武曲", "贪狼") && (ming.branch === "丑" || ming.branch === "未"),
      "武曲贪狼同宫", true, "武曲贪狼不同守丑未");

    // ---------- 机月同梁系 ----------
    add("机月同梁", ["天机", "太阴", "天同", "天梁"].every((x) => trioMajors.has(x)),
      "四星会齐", true, "机月同梁未全会三方");
    add("天同戌宫", mingHas("天同") && ming.branch === "戌", "天同在戌入庙", true, "天同不在戌宫坐命");
    add("巨机同临", mingPair("巨门", "天机") && (ming.branch === "卯" || ming.branch === "酉"),
      "巨门天机同宫", true, "巨门天机不同守卯酉");

    // ---------- 太阳天梁 / 巨门系 ----------
    add("阳梁昌禄", ["太阳", "天梁", "文昌", "禄存"].every((x) => trioStars.has(x)),
      "四星会齐", true, "阳梁昌禄未齐");
    add("巨日同宫", mingPair("太阳", "巨门") && (ming.branch === "寅" || ming.branch === "申"),
      "太阳巨门同宫", true, "太阳巨门不同守寅申");
    add("石中隐玉", mingHas("巨门") && (ming.branch === "子" || ming.branch === "午"),
      "巨门在子午", true, "巨门不在子午坐命");

    // ---------- 破军七杀 ----------
    add("英星入庙", mingHas("破军") && (ming.branch === "子" || ming.branch === "午"),
      "破军入庙", true, "破军不在子午坐命");
    add("七杀朝斗", mingHas("七杀") && ["寅", "申", "子", "午"].indexOf(ming.branch) >= 0,
      "七杀向斗", true, "七杀不在寅申子午坐命");
    add("马头带箭", ming.branch === "午" && ms.has("擎羊"), "午宫擎羊", true,
      "命宫不在午，或无擎羊");

    // ---------- 四化与禄马 ----------
    const huaVals = Object.keys(trioHua).map((k) => trioHua[k]);
    add("三奇嘉会", ["禄", "权", "科"].every((h) => huaVals.indexOf(h) >= 0),
      "禄权科会齐", true,
      (huaVals.length ? "三方只得" + huaVals.slice().sort().join("") + "，三化未齐"
        : "三方四正无化禄化权化科"));
    add("双禄交流", sameOrOpp("禄存", "", "禄"), "禄存与化禄同宫或对拱（会命）", true,
      twoWhere("禄存", "化禄"));
    add("双禄朝垣", trioStars.has("禄存") && huaVals.indexOf("禄") >= 0,
      "禄存与化禄同在三方", true, "禄存与化禄未同在三方");
    add("禄马交驰", sameOrOpp("禄存", "天马", ""), "禄存与天马同宫或对拱", true,
      twoWhere("禄存", "天马"));
    add("火贪格", sameOrOpp("火星", "贪狼", ""), "火星与贪狼同宫或对拱", true,
      twoWhere("火星", "贪狼"));
    add("铃贪格", sameOrOpp("铃星", "贪狼", ""), "铃星与贪狼同宫或对拱", true,
      twoWhere("铃星", "贪狼"));

    // ---------- 辅星 ----------
    add("文星拱命", trioStars.has("文昌") && trioStars.has("文曲"), "昌曲会命", true,
      "昌曲在" + where("文昌") + "，不在命宫三方");
    add("昌曲夹命", flanked(ming.index, "文昌", "文曲"), "昌曲夹命", true, "命宫两侧无昌曲");
    add("左右同宫", ms.has("左辅") && ms.has("右弼"), "辅弼同守命宫", true, "辅弼不同守命宫");
    add("左右夹命", flanked(ming.index, "左辅", "右弼"), "辅弼夹命", true, "命宫两侧无辅弼");
    add("魁钺夹命", flanked(ming.index, "天魁", "天钺"), "魁钺夹命", true, "命宫两侧无魁钺");
    add("天乙拱命", trioStars.has("天魁") && trioStars.has("天钺"), "魁钺会命", true,
      "魁钺未同会三方");

    // ---------- 中格 ----------
    add("命无正曜", mm.size === 0, "借对宫安星", false, "命宫有主星");
    add("杀破狼", ["七杀", "破军", "贪狼"].every((x) => trioMajors.has(x)), "三星会照", false,
      "杀破狼未全会三方");
    add("身命同宫", shen !== null && shen.index === ming.index, "身宫即命宫", false,
      "身宫不在命宫");
    add("天罗地网", ming.branch === "辰" || ming.branch === "戌",
      "命宫在" + ming.branch + (ming.branch === "辰" ? "（天罗）" : "（地网）"), false,
      "命宫不在辰戌");

    // ---------- 凶格 ----------
    const emptyHit = ["地空", "地劫"].filter((x) => ms.has(x));
    add("命里逢空", emptyHit.length > 0, "命宫见" + emptyHit.join("、"), false, "命宫无空劫");
    add("空劫夹命", flanked(ming.index, "地空", "地劫"), "空劫夹命", false, "命宫两侧无空劫");
    add("两重华盖", shen !== null && ms.has("华盖") && starSet(shen).has("华盖"),
      "命身皆坐华盖", false, "命身未同见华盖");
    add("火铃夹命", flanked(ming.index, "火星", "铃星"), "火铃夹命", false, "命宫两侧无火铃");
    add("羊陀夹忌", flankedHuaJi(chart), "羊陀夹化忌之宫", false, "无羊陀夹化忌");
    add("刑忌夹印", xingJiFlankSeal(chart), "擎羊与化忌夹天相", false, "天相未被擎羊化忌夹");
    add("巨火擎羊", ["巨门", "火星", "擎羊"].every((x) => trioStars.has(x)),
      "巨火羊同会", false, "巨火羊未同会三方");
    add("天机天梁擎羊会", ["天机", "天梁", "擎羊"].every((x) => trioStars.has(x)),
      "机梁羊同会", false, "机梁羊未同会三方");
    add("贪狼化忌", trioHua["贪狼"] === "忌", "贪狼化忌会命", false, "贪狼未化忌");
    add("廉贞化忌", trioHua["廉贞"] === "忌", "廉贞化忌会命", false, "廉贞未化忌");
    const mingJi = Object.keys(huaOf(ming)).filter((k) => huaOf(ming)[k] === "忌");
    add("命宫坐忌", mingJi.length > 0, "命宫坐" + mingJi.join("、"), false, "命宫无化忌");
    const sunB = brightOf("太阳"), moonB = brightOf("太阴");
    add("日月反背", ["陷", "不"].indexOf(sunB) >= 0 && ["陷", "不"].indexOf(moonB) >= 0,
      "日月俱陷", false, "日月未俱陷");
    const lonely = ["孤辰", "寡宿"].filter((x) => ms.has(x));
    add("孤辰寡宿坐命", lonely.length > 0, "命宫见" + lonely.join("、"), false, "命宫无孤寡");
    return out;
  }

  /* 天相（印）左右分别为天府与天梁 —— 财荫夹印 */
  function xiangFlankedByFuLiang(chart) {
    for (const p of chart.palaces) {
      const names = new Set(p.stars.map((s) => s.name));
      if (!names.has("天相")) continue;
      const l = chart.palaces.find((q) => q.index === mod(p.index - 1, 12));
      const r = chart.palaces.find((q) => q.index === mod(p.index + 1, 12));
      const ls = new Set(l.stars.map((s) => s.name)), rs = new Set(r.stars.map((s) => s.name));
      if ((ls.has("天府") && rs.has("天梁")) || (ls.has("天梁") && rs.has("天府"))) return true;
    }
    return false;
  }

  function flankedHuaJi(chart) {
    for (const p of chart.palaces) {
      const hasJi = p.stars.some((s) => s.hua === "忌");
      if (!hasJi) continue;
      const l = chart.palaces.find((q) => q.index === mod(p.index - 1, 12));
      const r = chart.palaces.find((q) => q.index === mod(p.index + 1, 12));
      const ln = new Set(l.stars.map((s) => s.name)), rn = new Set(r.stars.map((s) => s.name));
      if ((ln.has("擎羊") && rn.has("陀罗")) || (ln.has("陀罗") && rn.has("擎羊"))) return true;
    }
    return false;
  }

  function xingJiFlankSeal(chart) {
    for (const p of chart.palaces) {
      if (!p.stars.some((s) => s.name === "天相")) continue;
      const l = chart.palaces.find((q) => q.index === mod(p.index - 1, 12));
      const r = chart.palaces.find((q) => q.index === mod(p.index + 1, 12));
      const ln = new Set(l.stars.map((s) => s.name)), rn = new Set(r.stars.map((s) => s.name));
      const lj = l.stars.some((s) => s.hua === "忌"), rj = r.stars.some((s) => s.hua === "忌");
      if ((ln.has("擎羊") && rj) || (rn.has("擎羊") && lj)) return true;
    }
    return false;
  }

  function ziweiSummary(chart) {
    const ming = chart.palaces.find((p) => p.name === "命宫");
    const cai = chart.palaces.find((p) => p.name === "财帛");
    const guan = chart.palaces.find((p) => p.name === "官禄");
    // 格局本身是贵气，不能只看主星亮度（Python 侧同样处理）
    let mingScore = palaceScore(chart, ming);
    const pats0 = detectPatterns(chart);
    // 只有「成立」的才计分。全表三十条都带着不成立的条目，不过滤等于每条都算。
    const hits0 = pats0.filter((p) => p.status === "成立");
    const bonus = hits0.reduce((n, p) => n + ((D.PATTERN_BONUS || {})[p.name] || 0), 0);
    mingScore = Math.round(Math.max(2, Math.min(98, mingScore + bonus)) * 10) / 10;
    const majorMing = ming.stars.filter((s) => s.kind === "主星");
    return { mingScore, wealthScore: palaceScore(chart, cai),
      careerScore: palaceScore(chart, guan), patterns: detectPatterns(chart),
      patternHits: hits0.map((p) => p.name),
      patternBad: hits0.filter((p) => p.tier === "凶").map((p) => p.name),
      mingStars: majorMing.map((s) => s.name + (s.hua ? "化" + s.hua : "") + (s.brightness ? `[${s.brightness}]` : "")),
      // 分字段的版本：中文串没法在展示层安全地翻译，英文界面用这个自己拼
      mingStarParts: majorMing.map((s) => ({ name: s.name, hua: s.hua || "", bright: s.brightness || "" })),
      bodyPalace: (chart.palaces.find((p) => p.isBody) || {}).name || "" };
  }
  // 大限主题：中文原文在 data.js 的 DECADE_THEMES，这里只补英文，供英文界面用
  const DECADE_EN = {
    命宫: ["Self and direction", "building a personal position"],
    兄弟: ["Peers and cooperation", "siblings, partners, competitors matter"],
    夫妻: ["Intimacy", "marriage and long-term partnership"],
    子女: ["Creation and nurture", "children, creative work, investments"],
    财帛: ["Resources and cash flow", "income structure and money management"],
    疾厄: ["Body and stress", "health, mood, depletion"],
    迁移: ["Outside world", "travel, relocation, outside opportunity"],
    仆役: ["Network and team", "friends, staff, community"],
    官禄: ["Career and position", "profession and social role"],
    田宅: ["Roots and assets", "property, family, inner stability"],
    福德: ["Spirit and enjoyment", "mindset, interests, quality of life"],
    父母: ["Elders and institutions", "parents, superiors, the system"]
  };
  function decades(chart, asOf) {
    const now = asOf || new Date().getFullYear();
    return chart.palaces.map((p, k) => {
      const [s, e] = p.decade, sy = chart.birth.y + s - 1;
      const th = D.DECADE_THEMES[p.name] || ["", ""];
      const en = DECADE_EN[p.name] || ["", ""];
      return { index: k, branch: p.branch, palace: p.name, startAge: s, endAge: e,
        startYear: sy, endYear: sy + 9, theme: th[0], advice: th[1],
        themeEn: en[0], adviceEn: en[1],
        score: palaceScore(chart, p), active: sy <= now && now <= sy + 9 };
    });
  }
  function yearlyPalace(chart, year) {
    const idx = mod(year - 4, 60), yg = GAN[idx % 10], yz = ZHI[idx % 12];
    const p = chart.palaces.find((x) => x.branch === yz);
    const hua = {};
    D.SIHUA_SANHE[yg].forEach((st, i) => { hua[st] = ["禄", "权", "科", "忌"][i]; });
    const landed = {};
    chart.palaces.forEach((pal) => pal.stars.forEach((s) => {
      if (hua[s.name]) (landed[hua[s.name]] = landed[hua[s.name]] || []).push(`${s.name}→${pal.name}(${pal.branch})`);
    }));
    let sc = palaceScore(chart, p);
    if ((landed["禄"] || []).some((x) => x.includes(p.name))) sc += 6;
    if ((landed["忌"] || []).some((x) => x.includes(p.name))) sc -= 8;
    return { year, ganzhi: yg + yz, palace: p.name, branch: p.branch,
      score: Math.round(Math.max(2, Math.min(98, sc)) * 10) / 10, siHua: landed };
  }

  /* ---------------- overall score ---------------- */
  function entropy(w) {
    const vals = Object.values(w).filter((v) => v > 0), t = vals.reduce((a, b) => a + b, 0) || 1;
    return -vals.reduce((s, v) => s + (v / t) * Math.log(v / t), 0) / Math.log(5);
  }
  function shishenScore(chart, gods) {
    let total = 0;
    chart.pillars.forEach((p) => {
      p.hidden.forEach((h) => { if (gods.includes(shishen(chart.dayMaster, h))) total += 1.4; });
      if (p.position !== "day" && gods.includes(shishen(chart.dayMaster, p.gan))) total += 1.8;
    });
    return Math.max(6, Math.min(94, 34 + total * 6.2));
  }
  const PCT = D.PERCENTILES;
  const DIM_WEAK_ZH = {
    structure: "格局层次偏弱：取格不显或破格，弱于 {p}% 的命盘",
    flow: "五行偏枯，流通有断点，弱于 {p}% 的命盘",
    climate: "调候不足，先天气候支持有限，弱于 {p}% 的命盘",
    root: "年月根基一般，祖荫与早年环境帮助有限，弱于 {p}% 的命盘",
    ming: "紫微命宫力量偏弱，弱于 {p}% 的命盘",
    sanfang: "三方四正会照平淡，弱于 {p}% 的命盘",
    shensha: "神煞偏凶，弱于 {p}% 的命盘",
    relations: "合冲刑害偏杂：局中刑冲重叠或合多受绊，弱于 {p}% 的命盘"
  };
  const DIM_WEAK_EN = {
    structure: "Structurally weak: the pattern is unclear or broken — weaker than {p}% of charts",
    flow: "Elements are lopsided and the generating chain breaks — weaker than {p}% of charts",
    climate: "Climate support is thin — weaker than {p}% of charts",
    root: "Year/month foundations are ordinary — weaker than {p}% of charts",
    ming: "The life palace is underpowered — weaker than {p}% of charts",
    sanfang: "The trine and opposite are flat — weaker than {p}% of charts",
    shensha: "Malefic stars outweigh the benefics — weaker than {p}% of charts",
    relations: "Interactions are tangled: punishments and clashes overlap, or too many combinations bind the chart — weaker than {p}% of charts"
  };
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function yearPercentileOf(v) { return _pctOf(PCT.yearQuantiles, v); }
  function percentileOf(v) { return _pctOf(PCT.quantiles, v); }
  function _pctOf(q, v) {
    if (!q || !q[q.length - 1]) return 50;
    if (v <= q[0]) return 0;
    if (v >= q[q.length - 1]) return 100;
    for (let i = 0; i < 100; i++) {
      if (q[i] <= v && v <= q[i + 1]) {
        const span = (q[i + 1] - q[i]) || 1e-9;
        return Math.round((i + (v - q[i]) / span) * 10) / 10;
      }
    }
    return 50;
  }
  function tierOf(p) {
    return p >= 97 ? "上上格" : p >= 88 ? "上格" : p >= 72 ? "中上格" : p >= 40 ? "中格" : p >= 15 ? "中下格" : "下格";
  }
  const SUBST = { 壬: "癸", 癸: "壬", 庚: "辛", 辛: "庚", 甲: "乙", 乙: "甲", 丙: "丁", 丁: "丙", 戊: "己", 己: "戊" };

  function structureScore(c) {
    let s = 50; const plus = [], minus = [];
    const st = c.structure;
    if (st.kind === "特殊格") { s += 12; plus.push(T(`成${st.name}，特殊格局立得住`, `Exceptional ${structLabelEn(st.name)} holds together`)); }
    else if (st.transparent.length) { s += 10; plus.push(T(`${st.name}取格清晰（月令藏干透出）`, `${structLabelEn(st.name)} is cleanly established`)); }
    else { s += 4; plus.push(T(`${st.name}以月令本气论，格象平实`, `${structLabelEn(st.name)} by month-command root qi — plain`)); }
    const th = c.tiaohou, gans = c.pillars.map((p) => p.gan);
    const hidden = c.pillars.flatMap((p) => p.hidden);
    const pri = th.primary;
    if (pri && gans.includes(pri)) { s += 10; plus.push(T(`调候用神${pri}透干`, `Climate stem ${pri} is transparent`)); }
    else if (pri && hidden.includes(pri)) { s += 5; plus.push(T(`调候用神${pri}藏支，力弱可用`, `${pri} is hidden but usable`)); }
    else if (pri) {
      const sub = SUBST[pri];
      if (sub && (gans.includes(sub) || hidden.includes(sub))) {
        s += 2; plus.push(T(`调候${pri}不见，得${sub}同类代之，力减而意存`, `${py(pri)} absent, ${py(sub)} substitutes at reduced strength`));
      } else { s -= 6; minus.push(T(`调候${pri}全无，气候失和`, `No trace of climate stem ${pri}`)); }
    }
    const { favor } = strengthUseful(c);
    const dm = c.dayMasterWx;
    const yin = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dm);
    const cai = D.KE[dm];
    const guan = Object.keys(D.KE).find((k) => D.KE[k] === dm);
    const strong = c.strength >= 52;
    if (strong && (favor.includes(cai) || favor.includes(guan))) { s += 6; plus.push(T("身强而用财官，担得起", "Strong day master can carry wealth and office")); }
    else if (!strong && favor.includes(yin)) { s += 6; plus.push(T("身弱而用印比，扶得起", "Weak day master is supported by resource and peers")); }
    else if (strong && favor.includes(yin)) { s -= 4; minus.push(T("身已过旺而仍取印比，方向有偏", "Already over-strong yet still taking resource — wrong direction")); }
    else if (!strong && (favor.includes(cai) || favor.includes(guan))) { s -= 4; minus.push(T("身弱而取财官，力所不及", "Weak day master reaching for wealth and office — out of reach")); }
    let noble = 0;
    [["天乙贵人", 4], ["天德贵人", 3], ["月德贵人", 3]].forEach(([nm, v]) => { if (c.shensha[nm]) noble += v; });
    if (noble) { s += Math.min(8, noble); plus.push(T("命带天乙/天月二德，贵气有根", "Carries Tian Yi / Tian-De, Yue-De — real nobility markers")); }
    const mz = c.month.zhi;
    if (c.pillars.some((p, i) => i !== 1 && D.CHONG[mz] === p.zhi)) { s -= 6; minus.push(T("月令被冲，格局根气受损", "Month command clashed — the root is shaken")); }
    const dg = c.day.gan;
    if (c.pillars.some((p, i) => i !== 2 && D.GAN_HE[dg] && D.GAN_HE[dg][0] === p.gan)) { s -= 5; minus.push(T("日主被合，意志易受牵制", "Day master combined — will is easily pulled")); }
    if (st.name.indexOf("刃") >= 0) {
      const hasG = [c.year.shishenGan, c.month.shishenGan, c.hour.shishenGan].some((x) => x === "正官" || x === "七杀");
      if (!hasG) { s -= 6; minus.push(T("月刃无官杀制，刚而易折", "Month blade with no officer to control it — hard but brittle")); }
    }
    return [Math.max(20, Math.min(95, s)), plus, minus];
  }

  function flowScore(c, favor) {
    const es = c.elementScores, ent = entropy(es);
    let score = ent * 70 + 20;
    const notes = [];
    const order = ["木", "火", "土", "金", "水"];
    let chains = 0;
    for (let i = 0; i < 5; i++) {
      if (es[order[i]] >= 3 && es[order[(i + 1) % 5]] >= 3 && es[order[(i + 2) % 5]] >= 3) chains++;
    }
    if (chains) { score += Math.min(10, chains * 2.5); notes.push(T(`五行有 ${chains} 条连续相生链，气能流转`, `${chains} generating chains — energy circulates`)); }
    const weakest = Object.keys(es).sort((a, b) => es[a] - es[b])[0];
    if (es[weakest] < 2) {
      // 只在它是喜用时才算断点：忌神断尽本是清局，不该扣
      if (!favor || favor.indexOf(weakest) >= 0) {
        score -= 5;
        notes.push(T(`${weakest}近乎断绝（${es[weakest].toFixed(1)}%），流通有断点`,
          `${D.I18N.wx[weakest]} nearly absent — the chain breaks`));
      } else {
        notes.push(T(`${weakest}几近断绝（${es[weakest].toFixed(1)}%），但它是忌神，断之反成清局`,
          `${D.I18N.wx[weakest]} is nearly absent, but it is hostile — the break clears the chart`));
      }
    }
    return [Math.max(15, Math.min(95, score)), notes];
  }

  function climateScore(c) {
    const seq = c.tiaohou.sequence || "";
    if (!seq) return [60, []];
    const gans = c.pillars.map((p) => p.gan), hidden = c.pillars.flatMap((p) => p.hidden);
    let got = 0; const notes = [];
    [...seq].forEach((ch) => {
      if (gans.includes(ch)) got += 1;
      else if (hidden.includes(ch)) got += 0.75;
      else {
        const sub = SUBST[ch];
        if (sub && (gans.includes(sub) || hidden.includes(sub))) {
          got += 0.55;
          notes.push(T(`${ch}不见，以${sub}代之`, `${py(ch)} absent, ${py(sub)} substitutes`));
        }
      }
    });
    const ratio = got / seq.length;
    if (ratio >= 0.95) notes.push(T("调候齐备，先天气候得宜", "Climate complete — good starting conditions"));
    else if (ratio <= 0.1) notes.push(T("调候全缺，环境给的支持有限，需后天补", "Climate entirely absent — the environment under-supports; compensate later"));
    return [Math.max(30, Math.min(94, 46 + 40 * ratio)), notes];
  }

  function rootScore(c) {
    let s = 55; const notes = [];
    const y = c.year, m = c.month;
    if (["正官", "正印", "正财"].includes(y.shishenGan)) { s += 6; notes.push(T(`年干${y.gan}为${y.shishenGan}，祖上有位有守`, `Year stem ${y.gan} is ${D.I18N.shishen[y.shishenGan]} — family standing`)); }
    if (["七杀", "伤官", "劫财"].includes(y.shishenGan)) { s -= 3; notes.push(T(`年干${y.gan}为${y.shishenGan}，早年少庇荫`, `Year stem ${y.gan} is ${D.I18N.shishen[y.shishenGan]} — little shelter early`)); }
    ["天乙贵人", "天德贵人", "月德贵人", "太极贵人"].some((nm) => {
      const v = c.shensha[nm];
      if (v && v.positions.includes("年")) { s += 4; notes.push(T(`年支带${nm}`, `Year branch carries ${D.I18N.shensha[nm] || nm}`)); return true; }
      return false;
    });
    if (c.pillars.some((p, i) => i !== 0 && D.CHONG[y.zhi] === p.zhi)) { s -= 5; notes.push(T("年支被冲，根基有动", "Year branch clashed — the base moves")); }
    if (["正官", "正印", "正财", "食神"].includes(m.shishenGan)) { s += 3; notes.push(T(`月干${m.gan}为${m.shishenGan}，早年环境端正`, `Month stem ${m.gan} is ${D.I18N.shishen[m.shishenGan]} — orderly environment`)); }
    if (c.structure.name.indexOf("刃") >= 0) { s -= 2; notes.push(T("月令带刃，少年性烈", "Month blade — fierce in youth")); }
    return [Math.max(25, Math.min(92, s)), notes];
  }

  function shenshaScore(c) {
    let good = 0, mid = 0, bad = 0;
    Object.keys(c.shensha).forEach((k) => {
      const n = c.shensha[k].nature;
      if (n === "吉") good++; else if (n === "凶") bad++; else mid++;
    });
    return [Math.max(20, Math.min(94, 50 + 2.4 * good - 2.8 * bad + 0.8 * mid)), good, mid, bad];
  }

  // 合冲刑害：整盘是不是「内部撕扯」。与 scoring.relations_score 逐条对应。
  const REL_SEVERITY = { 六冲: 6.5, 三刑: 6.0, 相刑: 3.6, 自刑: 3.0,
    六害: 2.2, 六破: 1.8 };
  const REL_POSW = { 0: 0.70, 1: 1.20, 2: 1.20, 3: 0.70 };

  function relationsScore(c) {
    const model = c.relationsModel || relSettle(relAnalyse(c), c);
    const ue = strengthUseful(c);
    const favor = ue.favor, avoid = ue.avoid;
    const nodeOf = {};
    model.nodes.forEach(([i, z]) => { nodeOf[i] = z; });
    const side = (i) => {
      const m = model.merged[i];
      const el = m ? m[0] : D.ZHI_WUXING[D.ZHI.indexOf(nodeOf[i])];
      return favor.indexOf(el) >= 0 ? 1 : (avoid.indexOf(el) >= 0 ? -1 : 0);
    };
    let s = 58;
    const plus = [], minus = [];
    model.items.forEach((r) => {
      let w = 0;
      r.pos.forEach((i) => { w += (REL_POSW[i] === undefined ? 0.7 : REL_POSW[i]); });
      w /= Math.max(1, r.pos.length);
      if (REL_SEVERITY[r.kind] !== undefined) {
        const sev = REL_SEVERITY[r.kind];
        const mean = r.pos.reduce((a, i) => a + side(i), 0) / r.pos.length;
        if (r.kind === "六冲") s += mean * sev * w;
        else s -= sev * w * (0.55 + 0.45 * Math.max(0, mean));
        (mean > 0 ? plus : minus).push(relLabel(r));
      } else if (["三会", "三合", "半合", "六合"].indexOf(r.kind) >= 0 && r.transforms) {
        const gain = 9.0 * r.strength * w;
        if (favor.indexOf(r.element) >= 0) { s += gain; plus.push(relLabel(r)); }
        else if (avoid.indexOf(r.element) >= 0) { s -= gain; minus.push(relLabel(r)); }
        else plus.push(relLabel(r));
      }
    });
    const tal = relTally(model);
    if (tal.combineN >= 3) { s -= 4.5; minus.push("合多则绊"); }
    if (tal.clashN >= 3) { s -= 5.0; minus.push("刑冲重叠"); }
    if (model.items.some((r) => r.pos.indexOf(2) >= 0
        && (r.kind === "六冲" || r.kind === "三刑"))) {
      s -= 3.2;
      minus.push("日支受冲刑");
    }
    return [Math.max(20, Math.min(92, s)), plus, minus];
  }

  function scoreOverall(chart, zc) {
    const es = chart.elementScores;
    const [struct, sPlus, sMinus] = structureScore(chart);
    const [flow, fNotes] = flowScore(chart, usefulElements(chart).favor);
    const [climate, cNotes] = climateScore(chart);
    const [root, rNotes] = rootScore(chart);
    const [sh, nGood, nMid, nBad] = shenshaScore(chart);
    const [rels, relPlus, relMinus] = relationsScore(chart);
    const zs = ziweiSummary(zc);
    const qian = palaceScore(zc, zc.palaces.find((p) => p.name === "迁移"));
    const sanfang = Math.round((zs.mingScore * 0.4 + zs.wealthScore * 0.2 + zs.careerScore * 0.2 + qian * 0.2) * 10) / 10;
    const dims = { structure: Math.round(struct * 10) / 10, flow: Math.round(flow * 10) / 10,
      climate: Math.round(climate * 10) / 10, root: Math.round(root * 10) / 10,
      ming: zs.mingScore, sanfang, shensha: Math.round(sh * 10) / 10,
      relations: Math.round(rels * 10) / 10 };
    const W = PCT.weights;
    let overall = 0;
    PCT.dims.forEach((k) => { overall += dims[k] * W[k]; });
    const pctOf = {};
    PCT.dims.forEach((k) => {
      const st = PCT.dimStats[k] || [60, 8];
      pctOf[k] = Math.round((0.5 + 0.5 * erf(((dims[k] - st[0]) / (st[1] || 1)) / Math.SQRT2)) * 1000) / 10;
    });
    const weakDim = PCT.dims.slice().sort((a, b) => pctOf[a] - pctOf[b])[0];
    if (pctOf[weakDim] < 35) {
      sMinus.push(T(DIM_WEAK_ZH[weakDim].replace("{p}", Math.round(100 - pctOf[weakDim])),
        DIM_WEAK_EN[weakDim].replace("{p}", Math.round(100 - pctOf[weakDim]))));
    }
    overall = Math.max(2, Math.min(98, overall));
    const pct = percentileOf(overall);
    const dmwx = chart.dayMasterWx;
    const yin2 = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
    const shiEl = D.SHENG[dmwx], caiEl = D.KE[dmwx];
    const guanEl = Object.keys(D.KE).find((k) => D.KE[k] === dmwx);
    const share = (el) => es[el] || 0;
    const shareScore = (p) => Math.max(6, Math.min(92, 55 + (p - 20) * 1.2));
    const male = ["male", "男", "m"].includes(chart.gender);
    const loveEl = male ? caiEl : guanEl;
    const guanPal = palaceScore(zc, zc.palaces.find((p) => p.name === "官禄"));
    const caiPal = palaceScore(zc, zc.palaces.find((p) => p.name === "财帛"));
    const mingPal = palaceScore(zc, zc.palaces.find((p) => p.name === "命宫"));
    const jiPal = palaceScore(zc, zc.palaces.find((p) => p.name === "疾厄"));
    const puPal = palaceScore(zc, zc.palaces.find((p) => p.name === "仆役"));
    const career = 0.45 * (shareScore(share(guanEl)) + shareScore(share(shiEl))) / 2 + 0.55 * guanPal;
    const wealth = 0.45 * shareScore(share(caiEl)) + 0.55 * caiPal;
    const love = 0.35 * shareScore(share(loveEl)) + 0.35 * sanfang
      + 0.3 * (70 - 12 * zhiRels(chart.day.zhi, chart.day.zhi).filter((x) => ["六冲", "相刑", "相害"].includes(x)).length);
    const health = 0.4 * Math.max(10, 95 - Math.abs(share(dmwx) - 22) * 2.6) + 0.6 * jiPal;
    // 学业用「带格局加成」的命宫分，与 Python 侧一致；mingPal 是未加成的原始分
    const study = 0.45 * shareScore(share(yin2)) + 0.55 * zs.mingScore;
    const social = 0.35 * shareScore(share(dmwx)) + 0.65 * puPal;
    const clamp = (v) => Math.round(Math.max(6, Math.min(94, v)) * 10) / 10;
    return { overall: Math.round(overall * 10) / 10, percentile: pct, tier: tierOf(pct),
      dimensions: dims, dimPercentiles: pctOf, weights: W,
      areas: { career: clamp(career), wealth: clamp(wealth), love: clamp(love),
        health: clamp(health), study: clamp(study), social: clamp(social) },
      highlights: sPlus.concat(fNotes, cNotes, rNotes).filter((n) => !IS_WEAK(n)),
      weaknesses: sMinus.concat(sPlus.concat(fNotes, cNotes, rNotes).filter(IS_WEAK)),
      shenshaCount: { good: nGood, mid: nMid, bad: nBad } };
  }

  /* ---------------- interpretation ---------------- */
  const I18 = D.I18N;
  // 解释文本是双语的：中文那份保留原文，英文那份里的干支必须换成拼音，
  // 否则英文句子里会硬生生嵌一个汉字。
  const GAN_PY = { 甲: "Jia", 乙: "Yi", 丙: "Bing", 丁: "Ding", 戊: "Wu",
    己: "Ji", 庚: "Geng", 辛: "Xin", 壬: "Ren", 癸: "Gui" };
  const ZHI_PY = { 子: "Zi", 丑: "Chou", 寅: "Yin", 卯: "Mao", 辰: "Chen", 巳: "Si",
    午: "Wu", 未: "Wei", 申: "Shen", 酉: "You", 戌: "Xu", 亥: "Hai" };
  const py = (s) => !s ? s : [...s].map((ch) => GAN_PY[ch] || ZHI_PY[ch] || ch).join(" ");
  const STRUCT_EN_EXTRA = { 比肩格: "Parallel structure", 劫财格: "Rob Wealth structure",
    比劫格: "Rivals structure", 杂气格: "Mixed Qi structure",
    "从格（从势/从财杀）": "Following structure" };
  const STAGE_EN = { 长生: "Birth", 沐浴: "Bath", 冠带: "Capping", 临官: "Office",
    帝旺: "Peak", 衰: "Decline", 病: "Illness", 死: "Death", 墓: "Tomb",
    绝: "Severed", 胎: "Conception", 养: "Nurture" };
  const structLabelEn = (n) => (I18.structure && I18.structure[n]) || STRUCT_EN_EXTRA[n] || n;

  function interpretBazi(c) {
    const out = [];
    const dm = c.dayMaster, st = c.structure, th = c.tiaohou;
    const I = I18;
    const zh = [], en = [];
    zh.push(`日主${dm}（${c.dayMasterWx}）生于${c.month.zhi}月，月令为${c.strengthLabel}（同党占 ${c.strength.toFixed(1)}%）。`);
    en.push(`Day master ${py(dm)} (${I.wx[c.dayMasterWx]}) born in the ${py(c.month.zhi)} month; allies take ${c.strength.toFixed(1)}%, so it reads as ${I.strength[c.strengthLabel]}.`);
    const structZh = st.kind === "特殊格"
      ? "特殊格局不宜用常规喜忌去套，成败系于一点：那一点被破则全局翻转。"
      : "普通格重在用神是否透出有力；格清而用神无力，仍是平常；格浊而用神得力，反能成事。";
    const structEn = st.kind === "特殊格"
      ? "An exceptional structure — ordinary favourable-element logic does not apply; the whole chart turns on one point."
      : "An ordinary structure — what matters is whether the useful god is transparent and rooted. A clean structure with a weak god stays ordinary; a muddy one with a strong god still delivers.";
    zh.push(`取格：${st.basis}。${structZh}`);
    en.push(`Structure: ${structLabelEn(st.name)}. ${structEn}`);
    if (th.sequence) {
      const miss = th.missing.length;
      const total = th.sequence.length;
      zh.push(`调候取${th.sequence}（${th.primary}为先）：已见 ${th.satisfied.join("、") || "无"}；缺 ${th.missing.join("、") || "无"}。`
        + (miss === 0 ? "调候齐备，先天气候得宜，起手条件不差。"
          : miss === total ? "调候全缺，环境给的支持有限，需靠方位、行业与择时后补——这一块补不上，格局就上不去。"
            : "调候有缺，需靠后天补：方位、行业属性，以及流年走到该五行时集中发力。"));
      en.push(`Climate god: ${py(th.sequence)} (lead ${py(th.primary)}); present ${py(th.satisfied.join("")) || "none"}, missing ${py(th.missing.join("")) || "none"}. `
        + (miss === 0 ? "Complete — the starting conditions are workable."
          : miss === total ? "Nothing present; the environment under-supports you. Compensate by direction, industry and timing."
            : "Partially present: compensate by direction, industry, and by pushing in years that supply it."));
    }
    out.push({ key: "structure", zh, en });

    const counts = {};
    c.pillars.forEach((p) => {
      if (p.position !== "day") counts[p.shishenGan] = (counts[p.shishenGan] || 0) + 1;
      p.hidden.forEach((h) => {
        const g = shishen(dm, h);
        counts[g] = (counts[g] || 0) + 0.5;
      });
    });
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
    const zh2 = [], en2 = [];
    top.forEach((name) => {
      const info = I.shishenInfo[name];
      if (!info) return;
      zh2.push(`${name}（${info.zh.core}）在局中${counts[name] >= 2 ? "旺" : "有"}：${info.zh.pos}；但失衡时${info.zh.neg}。`);
      en2.push(`${I.shishen[name]} — ${info.en.core} — is ${counts[name] >= 2 ? "dominant" : "present"}: ${info.en.pos}; out of balance, ${info.en.neg}.`);
    });
    const absent = Object.keys(I.shishenInfo).filter((k) => !counts[k]);
    if (absent.length) {
      zh2.push("全局不见：" + absent.join("、") + "。缺失的十神往往正是要靠后天补的那一块。");
      en2.push("Entirely absent: " + absent.map((k) => I.shishen[k]).join(", ") + " — the missing gods mark where effort must compensate.");
    }
    out.push({ key: "shishen", zh: zh2, en: en2 });

    const zh3 = [], en3 = [];
    const tailZh = { year: "祖荫是起点，不是终点。", month: "月令一柱决定格局高低。",
      day: "日支被冲则婚姻与居所易动。", hour: "时柱为归宿，早年看不出来。" };
    const tailEn = { year: "Inheritance is a starting point, not an ending.", month: "This pillar sets the ceiling.",
      day: "A clash here moves marriage and home.", hour: "The hour is where things land; invisible early on." };
    c.pillars.forEach((p) => {
      const label = I.pillarInfo[p.position];
      zh3.push(`${p.gan}${p.zhi}（${p.shishenGan}／${p.shishenZhi}，${p.stage}）：${label.zh}。${tailZh[p.position]}`);
      en3.push(`${py(p.gan + p.zhi)} (${I.shishen[p.shishenGan] || "Self"} / ${I.shishen[p.shishenZhi] || p.shishenZhi}, ${STAGE_EN[p.stage] || p.stage}) — ${label.en}. ${tailEn[p.position]}`);
    });
    out.push({ key: "pillars", zh: zh3, en: en3 });

    const zh4 = [], en4 = [];
    const good = Object.keys(c.shensha).filter((k) => c.shensha[k].nature === "吉");
    const bad = Object.keys(c.shensha).filter((k) => c.shensha[k].nature === "凶");
    if (good.length) {
      zh4.push(`吉神：${good.join("、")}（${good.length} 颗）。吉神多则遇事有人兜，但要落在有用的宫位才算数。`);
      en4.push(`Auspicious: ${good.map((k) => I.shensha[k] || k).join(", ")} (${good.length}). They cushion setbacks — but only where they land in a palace that matters.`);
    }
    if (bad.length) {
      zh4.push(`凶煞：${bad.join("、")}（${bad.length} 颗）。凶煞不是灾，是需提前管理的方向——见冲则动，见合则缓。`);
      en4.push(`Inauspicious: ${bad.map((k) => I.shensha[k] || k).join(", ")} (${bad.length}). Not disasters — areas to manage: clash moves them, combination softens them.`);
    }
    const rel = c.relations;
    if (rel["冲"]) {
      zh4.push("刑冲：" + rel["冲"].map((x) => x.pair + x.type).join("；") + "。冲主动、主变，冲在哪柱，哪一段人生就多转折。");
      en4.push("Clashes: " + rel["冲"].map((x) => x.pair).join("; ") + " — clash means movement; the pillar it hits is where life turns.");
    }
    if (rel["合"]) {
      zh4.push("六合：" + rel["合"].map((x) => x.pair).join("；") + "。合主牵绊与整合，也可能把用神合走。");
      en4.push("Combinations: " + rel["合"].map((x) => x.pair).join("; ") + " — they bind and integrate, and can carry the useful god away.");
    }
    out.push({ key: "shensha", zh: zh4, en: en4 });
    return out;
  }

  function interpretZiwei(zc) {
    return zc.palaces.map((p) => {
      const theme = I18.zwPalace[p.name];
      const zh = [`${theme.zh[0]}：${theme.zh[1]}。`];
      const en = [`${theme.en[0]}: ${theme.en[1]}.`];
      const majors = p.stars.filter((s) => s.kind === "主星");
      if (majors.length) {
        zh.push(majors.map((s) => {
          const info = I18.zwStar[s.name];
          const b = I18.bright[s.brightness] || "";
          return `${s.name}${s.brightness ? "（" + s.brightness + "）" : ""}——${info.zh[0]}，${info.zh[1]}${b ? "；" + b : ""}`;
        }).join("；") + "。");
        en.push(majors.map((s) => {
          const info = I18.zwStar[s.name];
          const b = I18.brightEn[s.brightness] || "";
          return `${I18.zwStarEn[s.name]}${b ? " (" + b + ")" : ""} — ${info.en[0]}, ${info.en[1]}`;
        }).join("; ") + ".");
      } else {
        zh.push("本宫无十四主星，借对宫安星——性格与处境容易被环境塑造，也更容易受大限牵引。");
        en.push("No major star here: the palace borrows from the opposite one, so this area is shaped by circumstance and moves with the decade.");
      }
      p.stars.filter((s) => s.hua).forEach((s) => {
        zh.push(`${s.name}化${s.hua}：${I18.huaInfo[s.hua].zh}。`);
        en.push(`${I18.star[s.name] || s.name} transforms to ${I18.huaEn[s.hua]}: ${I18.huaInfo[s.hua].en}.`);
      });
      const bad = p.stars.filter((s) => s.kind === "煞星").map((s) => s.name);
      if (bad.length) {
        zh.push(`煞星：${bad.join("、")}——此宫的阻力来自这里，冲劲也来自这里。`);
        en.push("Malefics: " + bad.map((b) => I18.star[b] || b).join(", ") + " — both the friction and the drive of this palace come from them.");
      }
      if (p.selfHua.length) {
        zh.push("宫干自化：" + p.selfHua.map(([n, h]) => n + "化" + h).join("、") + "——力量向内消耗，容易自己跟自己较劲。");
        en.push("Self-transformation: " + p.selfHua.map(([n, h]) => `${I18.star[n] || n}→${I18.huaEn[h]}`).join(", ") + " — energy turns inward; you fight yourself here.");
      }
      const byIdx = {};
      zc.palaces.forEach((q) => { byIdx[q.index] = q; });
      const trio = [-4, 4, 6].map((o) => byIdx[mod(p.index + o, 12)]);
      const mj = [], mjEn = [];
      trio.forEach((q) => q.stars.forEach((s) => {
        if (s.kind !== "主星") return;
        mj.push(q.name + s.name);
        mjEn.push(`${I18.zwStarEn[s.name]} in ${I18.palaceEn[q.name]}`);
      }));
      if (mj.length) {
        zh.push("三方四正会" + mj.slice(0, 4).join("、") + "，此宫的力量由" + trio.map((q) => q.name).join("、") + "共同决定。");
        en.push("The trine and opposite bring " + mjEn.slice(0, 4).join(", ") + "; this palace is decided jointly with " + trio.map((q) => I18.palaceEn[q.name]).join(", ") + ".");
      }
      return { key: p.name, name: p.name, branch: p.branch, zh, en };
    });
  }

  /* ---------------- events ---------------- */
  const KIND_LABEL = { career: "事业", wealth: "财务", love: "感情", health: "健康",
    study: "学业", move: "迁移", family: "家庭", loss: "失去" };
  function pearson(xs, ys) {
    const n = xs.length; if (n < 2) return 0;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return (dx && dy) ? num / Math.sqrt(dx * dy) : 0;
  }
  function calibrate(rows) {
    const keys = ["用神", "冲合", "神煞", "大运"];
    if (rows.length < 5) return { 用神: 1, 冲合: 1, 神煞: 1, 大运: 1 };
    const X = rows.map((r) => keys.map((k) => r.components[k] || 0).concat([1]));
    const y = rows.map((r) => r.impact * 12);
    const m = 5;
    const A = [], b = [];
    for (let a = 0; a < m; a++) {
      A.push([]);
      for (let c = 0; c < m; c++) {
        let s = 0;
        for (let i = 0; i < X.length; i++) s += X[i][a] * X[i][c];
        A[a].push(s + (a === c ? 0.6 : 0));
      }
      b.push(X.reduce((s, row, i) => s + row[a] * y[i], 0));
    }
    for (let i = 0; i < m; i++) {
      let p = i;
      for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      if (Math.abs(A[i][i]) < 1e-9) continue;
      const inv = 1 / A[i][i];
      A[i] = A[i].map((v) => v * inv); b[i] *= inv;
      for (let k = 0; k < m; k++) {
        if (k === i) continue;
        const f = A[k][i];
        if (f) { A[k] = A[k].map((v, j) => v - f * A[i][j]); b[k] -= f * b[i]; }
      }
    }
    const sol = b.slice(0, 4).map((v) => Math.max(0.2, Math.min(2.2, v)));
    const out = {}; keys.forEach((k, i) => { out[k] = sol[i]; });
    return out;
  }
  function compareEvents(chart, events) {
    const rows = events.map((ev) => {
      const y = +ev.year, idx = mod(y - 4, 60), g = GAN[idx % 10], z = ZHI[idx % 12];
      const d = evaluatePeriod(chart, g, z, null);
      const impact = +ev.impact || 0;
      const agree = (impact > 0.5 && d.score >= 55) || (impact < -0.5 && d.score <= 45)
        || (Math.abs(impact) <= 0.5 && d.score > 45 && d.score < 55);
      return { year: y, ganzhi: g + z, kind: ev.kind || "career",
        kindLabel: KIND_LABEL[ev.kind || "career"] || "其他", impact, note: ev.note || "",
        predicted: d.score, components: d.components, relations: d.relations,
        cautions: d.cautions, themes: d.themes, agree };
    });
    const ws = calibrate(rows);
    rows.forEach((r) => {
      const c = r.components;
      r.calibrated = Math.round(Math.max(2, Math.min(98, 50 + ws["用神"] * (c["用神"] || 0)
        + ws["冲合"] * (c["冲合"] || 0) + ws["神煞"] * (c["神煞"] || 0) + ws["大运"] * (c["大运"] || 0))) * 10) / 10;
    });
    const n = rows.length, hit = rows.filter((r) => r.agree).length;
    const corr = pearson(rows.map((r) => r.predicted), rows.map((r) => r.impact));
    const corr2 = pearson(rows.map((r) => r.calibrated), rows.map((r) => r.impact));
    let verdict, verdictEn;
    const rate = n ? hit / n : 0;
    if (!n) { verdict = "未提供经历，无法校准。"; verdictEn = "No events supplied — nothing to calibrate against."; }
    else if (rate >= 0.75 && corr >= 0.5) { verdict = "模型与你的经历高度吻合，后续流年评分的参考价值较高。"; verdictEn = "The model tracks your reported years closely; its forward scores are worth weighing."; }
    else if (rate >= 0.6) { verdict = "模型大体吻合，局部年份偏乐观或偏保守，建议以校准后的分数为主。"; verdictEn = "Broad agreement, with some years read too optimistically or too harshly. Prefer the calibrated scores."; }
    else if (rate >= 0.4) { verdict = "吻合度一般——你的命局权重与通用模型有差异，校准权重已调整。"; verdictEn = "Moderate agreement — your chart's weights differ from the generic model. The weights have been refitted."; }
    else { verdict = "吻合度偏低。请核对：①出生时间是否已换算真太阳时/夏令时；②年份是否按立春计；③是否有时代或家庭变量压过个人命局。"; verdictEn = "Poor agreement. Check the birth time, whether years count from Li Chun, and whether era or family factors outweighed the chart."; }
    return { rows, n, hitRate: n ? Math.round(1000 * hit / n) / 10 : 0,
      correlation: Math.round(corr * 1000) / 1000,
      calibratedCorrelation: Math.round(corr2 * 1000) / 1000,
      weights: ws, verdict, verdictEn, misses: rows.filter((r) => !r.agree) };
  }

  /* ---------------- reading ---------------- */
  function buildReading(o) {
    const bazi = buildBazi(o);
    const ziwei = buildZiwei(o);
    const focus = o.focusYear || new Date().getFullYear();
    const scores = scoreOverall(bazi, ziwei);
    const zs = ziweiSummary(ziwei);
    const cycles = luckCycles(bazi, 10, focus);
    const act = cycles.find((c) => c.active) || cycles[0];
    const timeline = [];
    const startY = focus - 2;
    // 流年要另取 12 步大运、锚在流年起年：若复用上面那 10 步，
    // 靠后的年份会在 JS 端找不到大运而按「无大运」计分，与 Python 分叉。
    const tlCycles = luckCycles(bazi, 12, startY);
    for (let y = startY; y < startY + 12; y++) {
      const cyc = tlCycles.find((c) => c.startYear <= y && y <= c.endYear) || null;
      timeline.push(yearPeriod(bazi, y, cyc));
    }
    return { bazi, ziwei, scores, zsummary: zs, cycles,
      activeCycle: act ? act.label : "", timeline,
      months: monthPeriods(bazi, focus, act),
      events: o.events && o.events.length ? compareEvents(bazi, o.events) : null,
      focusYear: focus,
      ziweiDecades: decades(ziwei, focus),
      ziweiYear: yearlyPalace(ziwei, focus) };
  }

  function pctFromStats(stats, v) {
    const mu = stats ? stats[0] : 60, sd = stats ? (stats[1] || 1) : 8;
    return Math.round((0.5 + 0.5 * erf(((v - mu) / sd) / Math.SQRT2)) * 1000) / 10;
  }

  window.ML = { toJD, fromJD, lunarFromJD, lunarToJD,
    percentileOf, tierOf, pctFromStats, interpretBazi, interpretZiwei, termLocal, buildBazi, buildZiwei,
    luckCycles, startLuck, luckDirection, yearPeriod, monthPeriods, evaluatePeriod,
    palaceScore, detectPatterns, ziweiSummary, decades, yearlyPalace,
    scoreOverall, compareEvents, buildReading, usefulElements, strengthUseful, shishen, zhiRels,
    percentileOf, yearPercentileOf };
})();
