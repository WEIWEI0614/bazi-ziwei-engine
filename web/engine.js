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
        else { name = "月刃格"; basis = `月令${mz}为日主帝旺（羊刃）之地，${h}透干，取月刃格`; }
      } else {
        name = NAME[ss]; basis = `月令${mz}藏${h}（${layer}）透于天干，以${ss}取格`;
      }
    } else if (mwx === c.dayMasterWx) {
      if (mz === D.LU[dm]) { name = "建禄格"; basis = `月令${mz}为日主临官（禄）之地，取建禄格`; }
      else { name = "月刃格"; basis = `月令${mz}为日主帝旺（羊刃）之地，取月刃格`; }
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
    const dm = c.dayMaster, yz = c.year.zhi, dz = c.day.zhi, out = {};
    const put = (n, w) => { (out[n] = out[n] || []).push(w); };
    const posNames = { year: "年", month: "月", day: "日", hour: "时" };
    c.pillars.forEach((p) => {
      const w = posNames[p.position], z = p.zhi;
      if (D.TIANYI[dm].includes(z)) put("天乙贵人", w);
      if (D.WENCHANG[dm] === z) put("文昌", w);
      if (D.YANGREN[dm] === z) put("羊刃", w);
      if (D.LU[dm] === z) put("禄神", w);
      if (D.YIMA[yz] === z) put("驿马(年支)", w);
      if (D.YIMA[dz] === z) put("驿马(日支)", w);
      if (D.TAOHUA[yz] === z) put("桃花(年支)", w);
      if (D.HUAGAI[yz] === z) put("华盖(年支)", w);
      if (D.JIANGXING[yz] === z) put("将星(年支)", w);
      if (p.kong.includes(z)) put("空亡", w);
      if (["庚辰", "庚戌", "壬辰", "戊戌"].includes(p.gan + z)) put("魁罡", w);
    });
    c.shensha = out;
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
    [...(c.tiaohou.sequence || "")].forEach((ch) => {
      const w = D.GAN_WUXING[gi(ch)];
      if (!favor.includes(w)) favor.push(w);
    });
    return { favor, avoid, yin, shi, cai, guan, strong };
  }
  function band(s) {
    return s >= 78 ? "大吉" : s >= 65 ? "吉" : s >= 55 ? "小吉" : s >= 45 ? "平"
      : s >= 35 ? "小凶" : s >= 22 ? "凶" : "大凶";
  }
  const THEME_MAP = D.THEME_MAP;
  function evaluatePeriod(c, gan, zhi, luckCyc) {
    const dm = c.dayMaster, ssG = shishen(dm, gan), ssZ = shishen(dm, D.HIDDEN[zhi][0]);
    const { favor, avoid } = usefulElements(c);
    const comp = {};
    const add = elementOf(gan, zhi);
    let good = 0, bad = 0;
    Object.keys(add).forEach((el) => {
      if (add[el] <= 0) return;
      if (favor.includes(el)) good += add[el];
      if (avoid.includes(el)) bad += add[el];
    });
    comp["用神"] = Math.max(-26, Math.min(26, (good - bad) * 70));
    let penalty = 0, bonus = 0;
    const rels = [];
    const posNames = { year: "年", month: "月", day: "日", hour: "时" };
    c.pillars.forEach((p) => {
      const pos = posNames[p.position], w = POS_W[pos];
      zhiRels(p.zhi, zhi).forEach((r) => {
        rels.push(`${pos}支${p.zhi}与${zhi}${r}`);
        if (r === "六冲") penalty += 7 * w;
        else if (r === "相刑") penalty += 4 * w;
        else if (r === "相害" || r === "相破") penalty += 2.5 * w;
        else if (r === "六合") bonus += 3 * w;
        else if (r === "伏吟") penalty += 3 * w;
      });
      ganRels(p.gan, gan).forEach((r) => {
        rels.push(`${pos}干${p.gan}与${gan}${r}`);
        if (r === "天干相冲") penalty += 3.5 * w;
        else if (r === "天干五合") bonus += 2 * w;
      });
      if (D.GAN_CHONG[p.gan] === gan && D.CHONG[p.zhi] === zhi) {
        comp["冲合"] = (comp["冲合"] || 0) - 8;
        rels.push(`与${pos}柱天克地冲`);
      }
    });
    D.SANHE.forEach((grp) => {
      if (!grp.slice(0, 3).includes(zhi)) return;
      const have = [...new Set(c.pillars.map((p) => p.zhi).filter((z) => grp.slice(0, 3).includes(z) && z !== zhi))];
      if (have.length >= 2) { bonus += 5; rels.push(`${zhi}与命局成三合${grp[3]}局`); }
    });
    comp["冲合"] = (comp["冲合"] || 0) + bonus - penalty;
    let sha = 0;
    if (D.TIANYI[dm].includes(zhi)) { sha += 4; rels.push("流年天乙贵人"); }
    if (D.WENCHANG[dm] === zhi) { sha += 3; rels.push("流年文昌"); }
    if (D.LU[dm] === zhi) { sha += 3; rels.push("流年临禄"); }
    if (["辰", "戌", "丑", "未"].includes(zhi) && ["正官", "七杀"].includes(ssZ)) sha -= 2;
    comp["神煞"] = sha;
    let big = 0;
    if (luckCyc) {
      const el = elementOf(luckCyc.gan, luckCyc.zhi);
      const favs = Object.keys(el).filter((e) => favor.includes(e)).length;
      big = (favs - 2) * 2;
      if (D.GAN_CHONG[luckCyc.gan] === gan && D.CHONG[luckCyc.zhi] === zhi) { big -= 10; rels.push("大运流年天克地冲"); }
      if (zhi === luckCyc.zhi) { big -= 3; rels.push("流年伏吟大运"); }
    }
    comp["大运"] = big;
    const raw = 50 + comp["用神"] + comp["冲合"] + comp["神煞"] + comp["大运"];
    const score = Math.max(12, Math.min(92, 50 + (Math.max(2, Math.min(98, raw)) - 50) * 0.86));
    const themes = [...new Set([...(THEME_MAP[ssG] || []), ...(THEME_MAP[ssZ] || [])])];
    const cautions = [];
    rels.forEach((r) => {
      if (r.includes("六冲") && r.includes("日")) cautions.push("日支被冲：住所、婚姻或自身状态易有变动，忌仓促决定");
      else if (r.includes("六冲") && r.includes("月")) cautions.push("月柱被冲：工作环境或家庭结构面临调整");
      else if (r.includes("六冲") && r.includes("年")) cautions.push("年柱被冲：长辈、根基或长期规划受扰");
      else if (r.includes("天克地冲")) cautions.push("天克地冲：该领域阻力最大，宜守不宜攻");
      else if (r.includes("相刑")) cautions.push("相刑：易生是非、官非或健康小疾，注意契约与口舌");
      else if (r.includes("相害")) cautions.push("相害：人际暗耗，慎防被牵连");
      else if (r.includes("伏吟")) cautions.push("伏吟：旧事重来，情绪反复，宜静守");
    });
    if (["七杀", "伤官"].includes(ssG) && score < 48) cautions.push(`${ssG}当值而全局失衡：压力与是非集中，忌硬碰体制与上级`);
    if (["正官", "正印"].includes(ssG) && score >= 55) cautions.push("官印相生之年，宜按程序推进，勿走捷径以免失信");
    const opps = [];
    if (score >= 62) opps.push(`${ssG}/${ssZ}得用，是推进主业与积累信誉的窗口`);
    if (rels.some((r) => r.includes("天乙贵人"))) opps.push("天乙贵人到位：主动求见关键人物，成功率高");
    if (rels.some((r) => r.includes("文昌"))) opps.push("文昌到位：考试、论文、资格与公开发表皆宜");
    if (rels.some((r) => r.includes("临禄"))) opps.push("临禄：正财与职位稳固，适合谈薪与升迁");
    if (comp["用神"] >= 12) opps.push(`喜用${favor.join("")}当令，资源顺势而来，宜进取`);
    return { shishenGan: ssG, shishenZhi: ssZ, score: Math.round(score * 10) / 10, band: band(score),
      components: comp, relations: rels, themes, cautions, opportunities: opps };
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
    const ygLunar = GAN[mod(ld.year - 4, 10)];
    let mnum = ld.month;
    if (ld.isLeap) {
      if ((o.leapPolicy || "split") === "split") mnum = ld.day <= 15 ? ld.month : ld.month + 1;
      else if (o.leapPolicy === "next") mnum = ld.month + 1;
    }
    mnum = mod(mnum - 1, 12) + 1;
    const ming = mod(2 + (mnum - 1) - hidx, 12);
    const shen = mod(2 + (mnum - 1) + hidx, 12);
    const first = TIGER[gi(ygLunar)];
    const gans = [];
    for (let i = 0; i < 12; i++) gans.push(GAN[mod(first + i, 10)]);
    const mingGan = gans[mod(ming - 2, 12)], mingZhi = ZHI[ming];
    const ny = nayin(mingGan, mingZhi);
    const juWx = ny[ny.length - 1];
    const [juNum, juName] = D.JU[juWx];
    let offset = 0;
    while ((ld.day + offset) % juNum) offset++;
    const q = (ld.day + offset) / juNum;
    let iz = mod(q, 12) - 1;
    iz += offset % 2 === 0 ? offset : -offset;
    const ziIdx = mod(iz + 2, 12);
    const fuIdx = mod(4 - ziIdx, 12);
    const pos = {};
    pos["紫微"] = ziIdx;
    [[-1, "天机"], [-3, "太阳"], [-4, "武曲"], [-5, "天同"], [-8, "廉贞"]].forEach(([off, nm]) => { pos[nm] = mod(ziIdx + off, 12); });
    [[0, "天府"], [1, "太阴"], [2, "贪狼"], [3, "巨门"], [4, "天相"], [5, "天梁"], [6, "七杀"], [10, "破军"]].forEach(([off, nm]) => { pos[nm] = mod(fuIdx + off, 12); });
    pos["左辅"] = mod(4 + (mnum - 1), 12);
    pos["右弼"] = mod(10 - (mnum - 1), 12);
    pos["文昌"] = mod(10 - hidx, 12);
    pos["文曲"] = mod(4 + hidx, 12);
    const [kui, yue] = D.KUI_YUE[ygLunar];
    pos["天魁"] = zi(kui); pos["天钺"] = zi(yue);
    const lu = zi(D.LUCUN[ygLunar]);
    pos["禄存"] = lu; pos["擎羊"] = mod(lu + 1, 12); pos["陀罗"] = mod(lu - 1, 12);
    const yz = ZHI[mod(ld.year - 4, 12)];
    pos["火星"] = mod(zi(D.HUOXING_START[yz]) + hidx, 12);
    pos["铃星"] = mod(zi(D.LINGXING_START[yz]) + hidx, 12);
    pos["地空"] = mod(11 - hidx, 12); pos["地劫"] = mod(11 + hidx, 12);
    pos["天马"] = zi(D.YIMA[yz]);
    const tbl = (o.sihuaSchool === "feixing") ? D.SIHUA_FEIXING : D.SIHUA_SANHE;
    const huaMap = {};
    tbl[ygLunar].forEach((st, i) => { huaMap[st] = ["禄", "权", "科", "忌"][i]; });
    const chart = { name: o.name || "", gender: o.gender, birth: { y: o.y, m: o.m, d: o.d },
      lunar: ld, hourBranch: ZHI[hidx], mingBranch: ZHI[ming], shenBranch: ZHI[shen],
      ju: juName, juNum, ziweiBranch: ZHI[ziIdx], yearGan: ygLunar, palaces: [] };
    const yang = gi(ygLunar) % 2 === 0, male = ["male", "男", "m"].includes(o.gender);
    chart.decadeDirection = yang === male ? 1 : -1;
    for (let k = 0; k < 12; k++) {
      const idx = mod(ming - k, 12);
      const stars = [];
      Object.keys(pos).forEach((nm) => {
        if (pos[nm] !== idx) return;
        const kind = D.MAJOR_STARS.includes(nm) ? "主星" : D.LUCKY.includes(nm) ? "辅星" : "煞星";
        stars.push({ name: nm, kind, hua: huaMap[nm] || "",
          brightness: (D.BRIGHTNESS[nm] || {})[ZHI[idx]] || "" });
      });
      stars.sort((a, b) => (a.kind === "主星" ? 0 : 1) - (b.kind === "主星" ? 0 : 1));
      chart.palaces.push({ branch: ZHI[idx], index: idx, name: PAL[k], nameEn: PAL_EN[k],
        gan: gans[mod(idx - 2, 12)], stars, isBody: idx === shen });
    }
    const ages = [];
    for (let a = juNum; a < juNum + 130; a += 10) ages.push(a);
    chart.palaces.forEach((p, k) => { p.decade = [ages[k], ages[k] + 9]; });
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
  function scoreOverall(chart, zc) {
    const es = chart.elementScores;
    const flow = entropy(es) * 100;
    const st = chart.strength;
    const balance = Math.max(0, 100 - Math.abs(st - 52) * 3.2);
    const struct = 0.55 * balance + 0.45 * (chart.structure.kind === "特殊格" ? 78 : 62);
    const seq = chart.tiaohou.sequence || "";
    let climate = seq ? 100 * chart.tiaohou.satisfied.length / Math.max(1, seq.length) : 60;
    climate = Math.max(18, Math.min(96, 40 + climate * 0.6));
    const zs = ziweiSummary(zc);
    const qian = palaceScore(zc, zc.palaces.find((p) => p.name === "迁移"));
    const sanfang = Math.round((zs.mingScore * 0.4 + zs.wealthScore * 0.2 + zs.careerScore * 0.2 + qian * 0.2) * 10) / 10;
    const { favor } = usefulElements(chart);
    const present = favor.reduce((s, f) => s + (es[f] || 0), 0);
    const yongshen = Math.max(8, Math.min(96, present * 2.4));
    const dims = { structure: Math.round(struct * 10) / 10, flow: Math.round((flow * 0.85 + 8) * 10) / 10,
      climate: Math.round(climate * 10) / 10, ming: zs.mingScore, sanfang,
      yongshen: Math.round(yongshen * 10) / 10 };
    const W = { structure: 0.24, flow: 0.12, climate: 0.14, ming: 0.26, sanfang: 0.12, yongshen: 0.12 };
    const overall = Object.keys(dims).reduce((s, k) => s + dims[k] * W[k], 0);
    const tier = overall >= 78 ? "上格" : overall >= 68 ? "中上格" : overall >= 56 ? "中格" : overall >= 44 ? "中下格" : "下格";
    const dmwx = chart.dayMasterWx;
    const career = 0.45 * shishenScore(chart, ["正官", "七杀", "食神", "伤官"]) + 0.55 * zs.careerScore;
    const wealth = 0.45 * shishenScore(chart, ["正财", "偏财"]) + 0.55 * zs.wealthScore;
    const love = 0.4 * shishenScore(chart, ["正财", "正官", "偏财", "七杀"]) + 0.35 * sanfang
      + 0.25 * (70 - 12 * zhiRels(chart.day.zhi, chart.day.zhi).filter((x) => ["六冲", "相刑", "相害"].includes(x)).length);
    const health = 0.4 * (100 - Math.abs((es[dmwx] || 0) - 25) * 2.2) + 0.6 * palaceScore(zc, zc.palaces.find((p) => p.name === "疾厄"));
    const study = 0.45 * shishenScore(chart, ["正印", "偏印"]) + 0.55 * zs.mingScore;
    const social = 0.35 * shishenScore(chart, ["比肩", "劫财"]) + 0.65 * palaceScore(zc, zc.palaces.find((p) => p.name === "仆役"));
    const clamp = (v) => Math.round(Math.max(6, Math.min(96, v)) * 10) / 10;
    return { overall: Math.round(overall * 10) / 10, tier, dimensions: dims, weights: W,
      areas: { career: clamp(career), wealth: clamp(wealth), love: clamp(love),
        health: clamp(health), study: clamp(study), social: clamp(social) } };
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

  window.ML = { toJD, fromJD, lunarFromJD, termLocal, buildBazi, buildZiwei,
    luckCycles, startLuck, luckDirection, yearPeriod, monthPeriods, evaluatePeriod,
    palaceScore, detectPatterns, ziweiSummary, decades, yearlyPalace,
    scoreOverall, compareEvents, buildReading, usefulElements, shishen, zhiRels };
})();
