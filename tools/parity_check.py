"""Compare the browser engine against the Python engine, field by field.

    PYTHONPATH=. python tools/parity_check.py cases.json js.json

The two engines share generated data tables but not code, so every ported
formula is a place where they can drift. This reports the first few mismatches
per field instead of only a count, because a count tells you nothing about
which formula is wrong.
"""
from __future__ import annotations

import json
import sys

from mingli.reading import build_reading

TOL = 0.25


def _fmt(v):
    return f"{v:.1f}" if isinstance(v, float) else str(v)


def py_of(c: dict) -> dict:
    r = build_reading(c["name"], c["gender"], c["y"], c["m"], c["d"], c["h"], c["mi"],
                      c["lon"], c["tz"], c["trueSolar"], c["ziBoundary"],
                      "sanhe", c["leapPolicy"], c["focusYear"])
    b, z, s = r.chart, r.ziwei, r.scores
    g = r.grade or {}
    return {
        "tsOffset": (b.true_solar - b.birth_local).total_seconds() / 60.0,
        "four": " ".join(p.gan + p.zhi for p in b.pillars),
        "hidden": [h for p in b.pillars for h in ["".join(p.hidden)]],
        "nayin": [p.nayin for p in b.pillars],
        "stage": [p.stage for p in b.pillars],
        "kong": ["".join(p.kong) for p in b.pillars],
        "lunar": [b.lunar_date.year, b.lunar_date.month, b.lunar_date.day, b.lunar_date.is_leap],
        "strength": b.strength,
        "strengthLabel": b.strength_label,
        "elements": b.element_scores,
        "structure": [b.structure["name"], b.structure["kind"], b.structure["basis"]],
        "tiaohou": [b.tiaohou.get("sequence"), b.tiaohou.get("primary"),
                    "".join(b.tiaohou.get("satisfied") or []),
                    "".join(b.tiaohou.get("missing") or [])],
        "shensha": {k: [v["nature"], "/".join(v["positions"])] for k, v in b.shensha.items()},
        "relations": {k: "|".join(sorted(f"{x['pair']}:{x['type']}" for x in v))
                      for k, v in b.relations.items()},
        "mingBranch": z.ming_branch, "shenBranch": z.shen_branch, "ju": z.ju,
        "ziweiBranch": z.ziwei_branch, "mingZhu": z.ming_zhu, "shenZhu": z.shen_zhu,
        "douJun": z.dou_jun, "yearGan": z.year_gan,
        "sihua": sorted(f"{k}:{v}" for k, v in z.sihua.items()),
        "palaces": [[p.branch, p.name, p.gan,
                     ",".join(s.name + (s.hua or "") + (s.brightness or "") for s in p.stars),
                     p.changsheng, p.boshi, p.jiangqian, p.suiqian,
                     "/".join(str(a) for a in p.ages[:4]), "-".join(map(str, p.decade)),
                     ",".join(n + h for n, h in p.self_hua)]
                    for p in z.palaces],
        "overall": s["overall"], "percentile": s["percentile"], "tier": s["tier"],
        "dims": s["dimensions"], "areas": s["areas"],
        "nHi": len(s["highlights"]), "nWk": len(s["weaknesses"]),
        "grade": [g.get("score"), g.get("grade"),
                  (g.get("bazi") or {}).get("score"), (g.get("bazi") or {}).get("grade"),
                  (g.get("ziwei") or {}).get("score"), (g.get("ziwei") or {}).get("grade")],
        "cycles": [[c2.label, c2.start_age, c2.end_age, c2.start_year, c2.end_year]
                   for c2 in r.cycles],
        "timeline": [[t["name"], t["label"], t["score"], t["band"]] for t in r.timeline],
        "months": [[m.name, m.label, m.score, m.band] for m in r.months],
    }


def eq(a, b) -> bool:
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) <= TOL
        except (TypeError, ValueError):
            return a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a) == set(b) and all(eq(a[k], b[k]) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(eq(x, y) for x, y in zip(a, b))
    return a == b


def main() -> int:
    cases = {c["id"]: c for c in json.load(open(sys.argv[1]))}
    js = {o["id"]: o for o in json.load(open(sys.argv[2]))}
    bad: dict[str, int] = {}
    examples: list[tuple] = []
    for cid, j in js.items():
        if "error" in j:
            bad["__js_error__"] = bad.get("__js_error__", 0) + 1
            examples.append(("js_error", cid, j["error"]))
            continue
        p = py_of(cases[cid])
        for k in p:
            if k in ("nHi", "nWk", "percentile"):
                continue          # 文案条数随语言变化，不作判据
            if not eq(p[k], j.get(k)):
                bad[k] = bad.get(k, 0) + 1
                if len(examples) < 12:
                    examples.append((k, cid, p[k], j.get(k)))
    print("cases", len(js))
    print("mismatch by field:", bad or "none")
    for e in examples:
        print("  ", e[0], "case", e[1])
        print("     py:", str(e[2])[:220])
        print("     js:", str(e[3])[:220])
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
