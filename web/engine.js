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
      name: o.name || "", gender: o.gender, birth: ts, jd: jdT,
      lunar: lunarFromJD(jd), pillars, dayMaster: dm,
      dayMasterWx: D.GAN_WUXING[gi(dm)],
      trueSolarOffset: trueSolarOffset(jd, o.lon, o.tz === undefined ? 8 : o.tz),
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

  function scoreElements(c) {
    const sc = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    c.pillars.forEach((p) => {
      sc[p.ganWx] += D.STEM_W[p.position];
      const h = p.hidden, w = h.length === 1 ? [1] : h.length === 2 ? [0.7, 0.3] : [0.6, 0.28, 0.12];
      h.forEach((s, i) => { sc[D.GAN_WUXING[gi(s)]] += D.BRANCH_W[p.position] * w[i]; });
    });
    const state = D.SEASON_STATE[c.month.zhi];
    Object.keys(state).forEach((el) => { sc[el] *= D.STATE_MULT[state[el]]; });
    const zhis = c.pillars.map((p) => p.zhi);
    D.SANHE.forEach((grp) => {
      const uniq = [...new Set(grp.slice(0, 3).filter((z) => zhis.includes(z)))];
      if (uniq.length === 3) sc[grp[3]] += 0.18;
      else if (uniq.length === 2) sc[grp[3]] += 0.06;
    });
    D.SANHUI.forEach((grp) => {
      if (grp.slice(0, 3).every((z) => zhis.includes(z))) sc[grp[3]] += 0.2;
    });
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
    [["天乙贵人", SS.TIANYI], ["太极贵人", SS.TAIJI], ["文昌贵人", SS.WENCHANG],
     ["国印贵人", SS.GUOYIN], ["福星贵人", SS.FUXING], ["金舆", SS.JINYU],
     ["红艳", SS.HONGYAN], ["流霞", SS.LIUXIA], ["学堂", SS.XUETANG],
     ["禄神", SS.LU], ["羊刃", SS.YANGREN]].forEach(([nm, tbl]) => {
      put(nm, find(tbl[dm]), `日干${dm}查${nm}`);
    });
    [["驿马", SS.YIMA], ["桃花", SS.TAOHUA], ["华盖", SS.HUAGAI], ["将星", SS.JIANGXING],
     ["劫煞", SS.JIESHA], ["灾煞", SS.ZAISHA], ["亡神", SS.WANGSHEN]].forEach(([nm, tbl]) => {
      put(nm, find(tbl[yz]).concat(find(tbl[dz])), `年支/日支三合局查${nm}`);
    });
    const hong = mod(3 - zi(yz), 12);
    put("红鸾", find(ZHI[hong]), `年支${yz}查红鸾`);
    put("天喜", find(ZHI[mod(hong + 6, 12)]), "红鸾对宫为天喜");
    put("孤辰", find(SS.GUSHEN[yz]), `年支${yz}查孤辰`);
    put("寡宿", find(SS.GUASU[yz]), `年支${yz}查寡宿`);
    put("破碎", find(SS.POSUI[yz]), `年支${yz}查破碎`);
    put("蜚廉", find(SS.FEILIAN[yz]), `年支${yz}查蜚廉`);
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
      zhiRels(zs[i], zs[j]).forEach((t) => {
        const key = { 六合: "合", 六冲: "冲", 相害: "害", 相破: "破", 相刑: "刑", 自刑: "刑", 伏吟: "刑" }[t];
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
      const hit = zs.filter((z) => grp.slice(0, 3).includes(z));
      if (new Set(hit).size === 3) add("三会", { pair: hit.join(""), type: `三会${grp[3]}方` });
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
  function elementOf(g, z) {
    const d = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    d[D.GAN_WUXING[gi(g)]] += 0.4;
    const h = D.HIDDEN[z], w = h.length === 1 ? [1] : h.length === 2 ? [0.7, 0.3] : [0.6, 0.28, 0.12];
    h.forEach((s, i) => { d[D.GAN_WUXING[gi(s)]] += 0.6 * w[i]; });
    return d;
  }
  function usefulElements(c) {
    const dmwx = c.dayMasterWx;
    const yin = Object.keys(D.SHENG).find((k) => D.SHENG[k] === dmwx);
    const shi = D.SHENG[dmwx], cai = D.KE[dmwx];
    const guan = Object.keys(D.KE).find((k) => D.KE[k] === dmwx);
    const strong = c.strength >= 50;
    let favor = strong ? [shi, cai, guan] : [yin, dmwx];
    const avoid = strong ? [dmwx, yin] : [cai, guan, shi];
    // 调候只取主用（sequence 第一位），且必须从忌神里剔除；
    // 否则戊土这类佐神会同时出现在喜与忌中，favor 膨胀到四个五行。
    const seq = c.tiaohou.sequence || "";
    if (seq.length) {
      const w = D.GAN_WUXING[gi(seq[0])];
      const i = avoid.indexOf(w);
      if (i >= 0) avoid.splice(i, 1);
      if (!favor.includes(w)) favor.unshift(w);
    }
    return { favor, avoid, yin, shi, cai, guan, strong };
  }
  function band(s) {
    return s >= 80 ? "大吉" : s >= 68 ? "吉" : s >= 58 ? "小吉" : s >= 46 ? "平"
      : s >= 42 ? "小凶" : s >= 38 ? "偏弱" : "凶";
  }
  const THEME_MAP = D.THEME_MAP;
  const T = (zh, en) => ({ zh, en });
  const IS_WEAK = (n) => /断点|断绝|偏枯/.test(typeof n === "string" ? n : n.zh);

  const AUSPICIOUS = { 正财: 1, 正印: 1, 正官: 1, 食神: 1 };
  const OMINOUS = { 伤官: 1, 七杀: 1, 劫财: 1, 偏印: 1 };
  const GWX_MAP = (() => { const o = {}; D.GAN.split("").forEach((g, i) => { o[g] = D.GAN_WUXING[i]; }); return o; })();

  function tenGodScore(god, isFavor) {
    if (AUSPICIOUS[god]) return isFavor ? 5 : 1.5;
    if (OMINOUS[god]) return isFavor ? -1.5 : -5;
    return isFavor ? 1.5 : -1.5;
  }

  /* 流年/流月评分 —— 顺序依《子平真诠》：
       1 先看喜忌（地支为主） 2 再看十神（吉神/凶神×喜忌）
       3 后看会合刑冲（有合先论合） 4 再叠大运基调 5 神煞仅作辅助 */
  function evaluatePeriod(c, gan, zhi, luckCyc) {
    const dm = c.dayMaster;
    const ssG = shishen(dm, gan), ssZ = shishen(dm, D.HIDDEN[zhi][0]);
    const ue = usefulElements(c);
    const favor = ue.favor, avoid = ue.avoid;
    const comp = {};

    const add = elementOf(gan, zhi);
    const es = c.elementScores;
    let gain = 0, loss = 0;
    Object.keys(add).forEach((el) => {
      const v = add[el];
      if (v <= 0) return;
      if (favor.includes(el)) gain += v * 1.7;
      if (avoid.includes(el)) {
        // 忌神有制则不凶：局中有克它或泄它的五行且有力时，惩罚折半
        const ctrl = Object.keys(D.KE).find((k) => D.KE[k] === el);
        const drain = D.SHENG[el];
        const checked = Math.max(es[ctrl] || 0, es[drain] || 0);
        loss += v * (checked >= 8 ? 0.55 : 1.10);
      }
    });
    // 上限收到 ±18/−16：原来的 ±26 只要干支都落在喜用就顶格，
    // 于是同一张盘在 80 与 25 之间反复跳。
    comp["用神"] = Math.round(Math.max(-16, Math.min(18, (gain - loss) * 40)) * 10) / 10;
    comp["忌神有制"] = loss < Object.keys(add).filter((e) => avoid.includes(e))
      .reduce((n, e) => n + add[e] * 1.10, 0) ? 1 : 0;

    const fGan = favor.includes(GWX_MAP[gan]);
    const fZhi = favor.includes(GWX_MAP[D.HIDDEN[zhi][0]]);
    comp["十神"] = Math.round((tenGodScore(ssG, fGan) * 0.5 + tenGodScore(ssZ, fZhi) * 0.7) * 10) / 10;

    const rels = [];
    let penalty = 0, bonus = 0;
    const POSW = { year: 1.0, month: 1.2, day: 1.4, hour: 0.9 };
    const POSN = { year: "年", month: "月", day: "日", hour: "时" };
    c.pillars.forEach((p) => {
      const pos = POSN[p.position], w = POSW[p.position];
      const zr = zhiRels(p.zhi, zhi);
      const hasHe = zr.includes("六合");
      zr.forEach((r) => {
        rels.push(`${pos}支${p.zhi}与${zhi}${r}`);
        if (r === "六合") bonus += 3.2 * w;
        else if (r === "六冲") penalty += (hasHe ? 3.5 : 7.0) * w;
        else if (r === "相刑") penalty += 4.0 * w;
        else if (r === "相害" || r === "相破") penalty += 2.5 * w;
        else if (r === "伏吟") penalty += 3.5 * w;
      });
      ganRels(p.gan, gan).forEach((r) => {
        rels.push(`${pos}干${p.gan}与${gan}${r}`);
        if (r === "天干相冲") penalty += 3.5 * w;
        else if (r === "天干五合") bonus += 2.2 * w;
      });
      if (D.GAN_CHONG[p.gan] === gan && D.CHONG[p.zhi] === zhi) {
        penalty += 6.0 * w;
        rels.push(`与${pos}柱天克地冲`);
      }
    });
    D.SANHE.forEach((grp) => {
      if (!grp.slice(0, 3).includes(zhi)) return;
      const have = [...new Set(c.pillars.map((p) => p.zhi)
        .filter((z) => grp.slice(0, 3).includes(z) && z !== zhi))];
      if (have.length >= 2) { bonus += 5; rels.push(`${zhi}与命局成三合${grp[3]}局`); }
      else if (have.length === 1) { bonus += 2; rels.push(`${zhi}与${have[0]}半合${grp[3]}局`); }
    });
    comp["冲合"] = Math.round((bonus - penalty) * 10) / 10;

    let tone = 0, big = 0;
    if (luckCyc) {
      const ladd = elementOf(luckCyc.gan, luckCyc.zhi);
      let lg = 0, ll = 0;
      Object.keys(ladd).forEach((e) => {
        if (favor.includes(e)) lg += ladd[e];
        if (avoid.includes(e)) ll += ladd[e];
      });
      tone = Math.max(-1, Math.min(1, (lg - ll) * 1.8));
      big = tone * 7;
      if (D.GAN_CHONG[luckCyc.gan] === gan && D.CHONG[luckCyc.zhi] === zhi) {
        big -= 8; rels.push("大运流年天克地冲");
      }
      if (zhi === luckCyc.zhi) { big -= 3; rels.push("流年伏吟大运"); }
      else if (D.CHONG[luckCyc.zhi] === zhi) { big -= 2.5; rels.push("流年冲大运"); }
    }
    comp["大运"] = Math.round(big * 10) / 10;

    let sha = 0;
    if ((D.TIANYI[dm] || "").includes(zhi)) { sha += 4; rels.push("流年天乙贵人"); }
    if (D.WENCHANG[dm] === zhi) { sha += 3; rels.push("流年文昌"); }
    if (D.LU[dm] === zhi) { sha += 3; rels.push("流年临禄"); }
    if (["辰", "戌", "丑", "未"].includes(zhi) && (ssZ === "正官" || ssZ === "七杀")) sha -= 2;
    comp["神煞"] = sha;

    let raw = 50 + comp["用神"] + comp["十神"] + comp["冲合"] + comp["大运"] + comp["神煞"];
    // 大运吉而流年凶 → 不至大凶；大运凶而流年吉 → 吉力打折
    if (tone > 0 && raw < 50) raw = 50 - (50 - raw) * (1 - 0.42 * tone);
    else if (tone < 0 && raw > 50) raw = 50 + (raw - 50) * (1 - 0.42 * Math.abs(tone));

    // 收窄到 40–86：单年读数是「倾向」不是「判决」
    let score = 50 + (Math.max(0, Math.min(100, raw)) - 50) * 0.72;
    score = Math.max(40, Math.min(88, score));
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
    if (OMINOUS[ssG] && score < 48) cautions.push(T(`${ssG}当值而全局失衡：压力与是非集中，忌硬碰体制与上级`, `${ssG} rules an unbalanced period: pressure concentrates — do not fight authority`));
    if (AUSPICIOUS[ssG] && score >= 55) cautions.push(T("吉神当值，宜按程序推进，勿走捷径以免失信", "A benefic rules: proceed by procedure, do not cut corners"));

    if (score >= 62) opps.push(T(`${ssG}/${ssZ}得用，是推进主业与积累信誉的窗口`, `${ssG}/${ssZ} are useful: a window to push your main line`));
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
      band: band(score), components: comp, relations: rels,
      themes, cautions: uniq(cautions), opportunities: uniq(opps) };
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
        { score: Math.round((50 + (ev.score - 50) * 0.72) * 10) / 10 }));
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
  function detectPatterns(chart) {
    const ming = chart.palaces.find((p) => p.name === "命宫");
    const branches = {};
    chart.palaces.forEach((p) => { branches[p.branch] = p; });
    const tri = new Set([ming.branch]);
    [-4, 4, 6].forEach((o) => tri.add(ZHI[mod(ming.index + o, 12)]));
    const trioMajors = new Set();
    tri.forEach((b) => branches[b].stars.forEach((s) => { if (s.kind === "主星") trioMajors.add(s.name); }));
    const mingMajors = new Set(ming.stars.filter((s) => s.kind === "主星").map((s) => s.name));
    const found = [];
    const add = (n) => { const p = D.PATTERNS.find((x) => x[0] === n); if (p && !found.some((f) => f.name === n)) found.push({ name: p[0], desc: p[1] }); };
    if (trioMajors.has("紫微") && trioMajors.has("天府")) add("紫府朝垣");
    if (mingMajors.has("紫微")) {
      const helpers = new Set(ming.stars.map((s) => s.name));
      [-4, 4, 6].forEach((o) => branches[ZHI[mod(ming.index + o, 12)]].stars.forEach((s) => helpers.add(s.name)));
      if ((["左辅", "右弼"].some((x) => helpers.has(x))) && (["天魁", "天钺"].some((x) => helpers.has(x)))) add("君臣慶會");
      if (ming.branch === "午") add("極向離明");
      if (trioMajors.has("破軍")) add("英星入廟");
    }
    if (["七殺", "破軍", "貪狼"].every((x) => trioMajors.has(x))) add("殺破狼");
    if (["天機", "太陰", "天同", "天梁"].every((x) => trioMajors.has(x))) add("機月同梁");
    if (mingMajors.has("太陰") && ming.branch === "亥") add("月朗天門");
    if (mingMajors.has("太陽") && ming.branch === "卯") add("日照雷門");
    if (mingMajors.has("巨門") && ["子", "午"].includes(ming.branch)) add("石中隱玉");
    if (!ming.stars.some((s) => s.kind === "主星")) add("命無正曜");
    return found;
  }
  function ziweiSummary(chart) {
    const ming = chart.palaces.find((p) => p.name === "命宫");
    const cai = chart.palaces.find((p) => p.name === "财帛");
    const guan = chart.palaces.find((p) => p.name === "官禄");
    return { mingScore: palaceScore(chart, ming), wealthScore: palaceScore(chart, cai),
      careerScore: palaceScore(chart, guan), patterns: detectPatterns(chart),
      mingStars: ming.stars.filter((s) => s.kind === "主星").map((s) => s.name + (s.hua ? "化" + s.hua : "") + (s.brightness ? `[${s.brightness}]` : "")),
      bodyPalace: (chart.palaces.find((p) => p.isBody) || {}).name || "" };
  }
  function decades(chart, asOf) {
    const now = asOf || new Date().getFullYear();
    return chart.palaces.map((p, k) => {
      const [s, e] = p.decade, sy = chart.birth.y + s - 1;
      const th = D.DECADE_THEMES[p.name] || ["", ""];
      return { index: k, branch: p.branch, palace: p.name, startAge: s, endAge: e,
        startYear: sy, endYear: sy + 9, theme: th[0], advice: th[1],
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
    shensha: "神煞偏凶，弱于 {p}% 的命盘"
  };
  const DIM_WEAK_EN = {
    structure: "Structurally weak: the pattern is unclear or broken — weaker than {p}% of charts",
    flow: "Elements are lopsided and the generating chain breaks — weaker than {p}% of charts",
    climate: "Climate support is thin — weaker than {p}% of charts",
    root: "Year/month foundations are ordinary — weaker than {p}% of charts",
    ming: "The life palace is underpowered — weaker than {p}% of charts",
    sanfang: "The trine and opposite are flat — weaker than {p}% of charts",
    shensha: "Malefic stars outweigh the benefics — weaker than {p}% of charts"
  };
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function percentileOf(v) {
    const q = PCT.quantiles;
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
    if (st.kind === "特殊格") { s += 12; plus.push(T(`成${st.name}，特殊格局立得住`, `Exceptional ${st.name} holds together`)); }
    else if (st.transparent.length) { s += 10; plus.push(T(`${st.name}取格清晰（月令藏干透出）`, `${st.name} is cleanly established`)); }
    else { s += 4; plus.push(T(`${st.name}以月令本气论，格象平实`, `${st.name} by month-command root qi — plain`)); }
    const th = c.tiaohou, gans = c.pillars.map((p) => p.gan);
    const hidden = c.pillars.flatMap((p) => p.hidden);
    const pri = th.primary;
    if (pri && gans.includes(pri)) { s += 10; plus.push(T(`调候用神${pri}透干`, `Climate stem ${pri} is transparent`)); }
    else if (pri && hidden.includes(pri)) { s += 5; plus.push(T(`调候用神${pri}藏支，力弱可用`, `${pri} is hidden but usable`)); }
    else if (pri) {
      const sub = SUBST[pri];
      if (sub && (gans.includes(sub) || hidden.includes(sub))) {
        s += 2; plus.push(T(`调候${pri}不见，得${sub}同类代之，力减而意存`, `${pri} absent, ${sub} substitutes at reduced strength`));
      } else { s -= 6; minus.push(T(`调候${pri}全无，气候失和`, `No trace of climate stem ${pri}`)); }
    }
    const { favor } = usefulElements(c);
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

  function flowScore(c) {
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
    if (es[weakest] < 2) { score -= 5; notes.push(T(`${weakest}近乎断绝（${es[weakest].toFixed(1)}%），流通有断点`, `${D.I18N.wx[weakest]} nearly absent — the chain breaks`)); }
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
          notes.push(T(`${ch}不见，以${sub}代之`, `${ch} absent, ${sub} substitutes`));
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

  function scoreOverall(chart, zc) {
    const es = chart.elementScores;
    const [struct, sPlus, sMinus] = structureScore(chart);
    const [flow, fNotes] = flowScore(chart);
    const [climate, cNotes] = climateScore(chart);
    const [root, rNotes] = rootScore(chart);
    const [sh, nGood, nMid, nBad] = shenshaScore(chart);
    const zs = ziweiSummary(zc);
    const qian = palaceScore(zc, zc.palaces.find((p) => p.name === "迁移"));
    const sanfang = Math.round((zs.mingScore * 0.4 + zs.wealthScore * 0.2 + zs.careerScore * 0.2 + qian * 0.2) * 10) / 10;
    const dims = { structure: Math.round(struct * 10) / 10, flow: Math.round(flow * 10) / 10,
      climate: Math.round(climate * 10) / 10, root: Math.round(root * 10) / 10,
      ming: zs.mingScore, sanfang, shensha: Math.round(sh * 10) / 10 };
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
    const study = 0.45 * shareScore(share(yin2)) + 0.55 * mingPal;
    const social = 0.35 * shareScore(share(dmwx)) + 0.65 * puPal;
    const clamp = (v) => Math.round(Math.max(6, Math.min(94, v)) * 10) / 10;
    return { overall: Math.round(overall * 10) / 10, percentile: pct, tier: tierOf(pct),
      dimensions: dims, weights: W,
      areas: { career: clamp(career), wealth: clamp(wealth), love: clamp(love),
        health: clamp(health), study: clamp(study), social: clamp(social) },
      highlights: sPlus.concat(fNotes, cNotes, rNotes).filter((n) => !IS_WEAK(n)),
      weaknesses: sMinus.concat(sPlus.concat(fNotes, cNotes, rNotes).filter(IS_WEAK)),
      shenshaCount: { good: nGood, mid: nMid, bad: nBad } };
  }

  /* ---------------- interpretation ---------------- */
  const I18 = D.I18N;

  function interpretBazi(c) {
    const out = [];
    const dm = c.dayMaster, st = c.structure, th = c.tiaohou;
    const I = I18;
    const zh = [], en = [];
    zh.push(`日主${dm}（${c.dayMasterWx}）生于${c.month.zhi}月，月令为${c.strengthLabel}（同党占 ${c.strength.toFixed(1)}%）。`);
    en.push(`Day master ${dm} (${I.wx[c.dayMasterWx]}) born in the ${c.month.zhi} month; allies take ${c.strength.toFixed(1)}%, so it reads as ${I.strength[c.strengthLabel]}.`);
    const structZh = st.kind === "特殊格"
      ? "特殊格局不宜用常规喜忌去套，成败系于一点：那一点被破则全局翻转。"
      : "普通格重在用神是否透出有力；格清而用神无力，仍是平常；格浊而用神得力，反能成事。";
    const structEn = st.kind === "特殊格"
      ? "An exceptional structure — ordinary favourable-element logic does not apply; the whole chart turns on one point."
      : "An ordinary structure — what matters is whether the useful god is transparent and rooted. A clean structure with a weak god stays ordinary; a muddy one with a strong god still delivers.";
    zh.push(`取格：${st.basis}。${structZh}`);
    en.push(`Structure: ${I.structure[st.name] || st.name}. ${structEn}`);
    if (th.sequence) {
      const miss = th.missing.length;
      const total = th.sequence.length;
      zh.push(`调候取${th.sequence}（${th.primary}为先）：已见 ${th.satisfied.join("、") || "无"}；缺 ${th.missing.join("、") || "无"}。`
        + (miss === 0 ? "调候齐备，先天气候得宜，起手条件不差。"
          : miss === total ? "调候全缺，环境给的支持有限，需靠方位、行业与择时后补——这一块补不上，格局就上不去。"
            : "调候有缺，需靠后天补：方位、行业属性，以及流年走到该五行时集中发力。"));
      en.push(`Climate god: ${th.sequence} (lead ${th.primary}); present ${th.satisfied.join(", ") || "none"}, missing ${th.missing.join(", ") || "none"}. `
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
      en3.push(`${p.gan}${p.zhi} (${I.shishen[p.shishenGan]} / ${I.shishen[p.shishenZhi]}, ${p.stage}) — ${label.en}. ${tailEn[p.position]}`);
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
    let verdict;
    const rate = n ? hit / n : 0;
    if (!n) verdict = "未提供经历，无法校准。";
    else if (rate >= 0.75 && corr >= 0.5) verdict = "模型与你的经历高度吻合，后续流年评分的参考价值较高。";
    else if (rate >= 0.6) verdict = "模型大体吻合，局部年份偏乐观或偏保守，建议以校准后的分数为主。";
    else if (rate >= 0.4) verdict = "吻合度一般——你的命局权重与通用模型有差异，校准权重已调整。";
    else verdict = "吻合度偏低。请核对：①出生时间是否已换算真太阳时/夏令时；②年份是否按立春计；③是否有时代或家庭变量压过个人命局。";
    return { rows, n, hitRate: n ? Math.round(1000 * hit / n) / 10 : 0,
      correlation: Math.round(corr * 1000) / 1000,
      calibratedCorrelation: Math.round(corr2 * 1000) / 1000,
      weights: ws, verdict, misses: rows.filter((r) => !r.agree) };
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
    for (let y = startY; y < startY + 12; y++) {
      const cyc = cycles.find((c) => c.startYear <= y && y <= c.endYear) || null;
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

  window.ML = { toJD, fromJD, lunarFromJD, lunarToJD,
    percentileOf, tierOf, interpretBazi, interpretZiwei, termLocal, buildBazi, buildZiwei,
    luckCycles, startLuck, luckDirection, yearPeriod, monthPeriods, evaluatePeriod,
    palaceScore, detectPatterns, ziweiSummary, decades, yearlyPalace,
    scoreOverall, compareEvents, buildReading, usefulElements, shishen, zhiRels };
})();
