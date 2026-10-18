/* Wide-field dump of the browser engine for parity checking against Python.
   Usage: node tools/parity_ext.js <cases.json> <out.json> */
const fs = require("fs"), path = require("path");
global.window = {};
const root = path.join(__dirname, "..", "web");
eval(fs.readFileSync(path.join(root, "data.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "engine.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "extra.js"), "utf8"));

const cases = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = cases.map((c) => {
  try {
    const r = window.ML.buildReading(c);
    const b = r.bazi, z = r.ziwei;
    return {
      id: c.id,
      tsOffset: b.trueSolarOffset,
      four: b.pillars.map((p) => p.gan + p.zhi).join(" "),
      hidden: b.pillars.map((p) => p.hidden.join("")),
      nayin: b.pillars.map((p) => p.nayin),
      stage: b.pillars.map((p) => p.stage),
      kong: b.pillars.map((p) => p.kong.join("")),
      lunar: [b.lunar.year, b.lunar.month, b.lunar.day, b.lunar.isLeap],
      strength: b.strength,
      strengthLabel: b.strengthLabel,
      elements: b.elementScores,
      structure: [b.structure.name, b.structure.kind, b.structure.basis],
      tiaohou: [b.tiaohou.sequence, b.tiaohou.primary,
        (b.tiaohou.satisfied || []).join(""), (b.tiaohou.missing || []).join("")],
      shensha: Object.fromEntries(Object.keys(b.shensha).map((k) =>
        [k, [b.shensha[k].nature, b.shensha[k].positions.join("/")]])),
      relations: Object.fromEntries(Object.keys(b.relations).map((k) =>
        [k, b.relations[k].map((x) => x.pair + ":" + x.type).sort().join("|")])),
      mingBranch: z.mingBranch, shenBranch: z.shenBranch, ju: z.ju,
      ziweiBranch: z.ziweiBranch, mingZhu: z.mingZhu, shenZhu: z.shenZhu,
      douJun: z.douJun, yearGan: z.yearGan,
      sihua: Object.keys(z.sihua).map((k) => k + ":" + z.sihua[k]).sort(),
      palaces: z.palaces.map((p) => [p.branch, p.name, p.gan,
        p.stars.map((s) => s.name + (s.hua || "") + (s.brightness || "")).join(","),
        p.changsheng, p.boshi, p.jiangqian, p.suiqian,
        p.ages.slice(0, 4).join("/"), p.decade.join("-"),
        (p.selfHua || []).map((x) => x[0] + x[1]).join(",")]),
      overall: r.scores.overall, percentile: r.scores.percentile, tier: r.scores.tier,
      dims: r.scores.dimensions, areas: r.scores.areas,
      nHi: (r.scores.highlights || []).length, nWk: (r.scores.weaknesses || []).length,
      grade: r.grade ? [r.grade.score, r.grade.grade,
        r.grade.bazi.score, r.grade.bazi.grade,
        r.grade.ziwei.score, r.grade.ziwei.grade] : null,
      cycles: r.cycles.map((x) => [x.label, x.startAge, x.endAge, x.startYear, x.endYear]),
      timeline: r.timeline.map((t) => [t.name, t.label, t.score, t.band]),
      months: r.months.map((m) => [m.name, m.label, m.score, m.band]),
    };
  } catch (e) {
    return { id: c.id, error: String(e && e.stack ? e.stack.split("\n")[0] : e) };
  }
});
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log("js done", out.length, "errors:", out.filter((o) => o.error).length);
out.filter((o) => o.error).slice(0, 3).forEach((o) => console.log("  ", o.id, o.error));
