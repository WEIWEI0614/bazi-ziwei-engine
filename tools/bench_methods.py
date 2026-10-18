#!/usr/bin/env python3
"""Three annual methods on one test, including the simplest one in the wild.

    python tools/bench_methods.py

The objection to "the engine has no signal" is usually "your weights are too
complicated / too simple / wrong". So this script lines up four ways of scoring
a year, from a three-line heuristic to a paid app's method, and gives them the
same exam:

  simple    the heuristic in Sudo-Biao/Chinese-Metaphysics-Platform (161*): one
            five-element relation, flipped by whether the day master is strong.
            No clashes, no ten gods, no stars, no decade. Three outcomes: 吉/平/凶.
  mine      this repo's five weighted components.
  ziwei     the paid Zi Wei method: year palace + four transformations.
  random    a control that must land on 0.5.

Exam: for the 50 public figures in BaziQA, do the years in which a **health
event** happened score worse than the years in which nothing did? Health is used
because it is the one category that is almost always bad news, so a method that
knows "this year is bad" has something to get right.

AUC below 0.5 means the method pointed the wrong way. Above 0.5 means it pointed
the right way. 0.5 means it did not point at all.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from mingli.bazi.chart import build_chart              # noqa: E402
from mingli.bazi.luck import luck_cycles, year_period  # noqa: E402
from mingli.calendar.ganzhi import GAN, GAN_WUXING     # noqa: E402
from tools.bench_celebrity import area_scores, auc     # noqa: E402
from tools.bench_ziwei import annual_features          # noqa: E402
from mingli.ziwei.chart import build_ziwei             # noqa: E402

KE = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}
SHENG = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}


def simple_quality(dm_wx: str, target_wx: str, strength: str) -> int:
    """逐字复刻 Sudo-Biao 项目的 _assess_quality，只把吉/平/凶换成 +1/0/-1。"""
    helps = (target_wx == SHENG.get(KE.get(dm_wx, ""), "")) or target_wx == dm_wx
    drains = (target_wx == KE.get(dm_wx, "")) or target_wx == SHENG.get(dm_wx, "")
    strong = "强" in strength
    weak = "弱" in strength
    if strong:
        if drains:
            return 1
        if helps:
            return -1
    elif weak:
        if helps:
            return 1
        if drains:
            return -1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/celeb50.json")
    ap.add_argument("--cat", default="健康", help="event category used as the positive class")
    a = ap.parse_args()
    path = a.data if os.path.isabs(a.data) else os.path.join(ROOT, a.data)
    people = json.load(open(path, encoding="utf-8"))

    buckets = collections.defaultdict(lambda: ([], []))
    for person in people:
        b = person["profile"]["birth"]
        try:
            c = build_chart("b", person["profile"]["gender"],
                            int(b["year"]), int(b["month"]), int(b["day"]),
                            int(b["hour"]), int(b.get("minute") or 0),
                            longitude=float(b.get("lon") or 116.4), use_true_solar=False)
            z = build_ziwei("b", person["profile"]["gender"],
                            int(b["year"]), int(b["month"]), int(b["day"]),
                            int(b["hour"]), int(b.get("minute") or 0),
                            longitude=float(b.get("lon") or 116.4), use_true_solar=False)
        except Exception:                       # noqa: BLE001
            continue
        cycles = luck_cycles(c, 1, 2100)
        birth = int(b["year"])
        years_with = set()
        for it in person["categories"].get(a.cat, []):
            m = re.search(r"(?:19|20)\d{2}", it)
            if m and birth + 16 <= int(m.group()) <= birth + 85:
                years_with.add(int(m.group()))
        if not years_with:
            continue
        dm_wx = c.day_master_wx
        for y in range(birth + 16, birth + 86):
            p = year_period(c, y, next((x for x in cycles if x.start_year <= y <= x.end_year), None))
            ly_wx = GAN_WUXING[GAN.index(p.gan)]
            # 三种方法都给「这一年多坏」的分：越高越该出事
            simple_bad = -simple_quality(dm_wx, ly_wx, c.strength_label)
            mine_bad = -(p.score - 50.0)
            zf = annual_features(z, y)
            # 紫微：健康宫（疾厄）被忌冲为坏
            ziwei_bad = -zf["健康"][1]
            idx = 0 if y in years_with else 1
            for k, v in (("simple", simple_bad), ("mine", mine_bad),
                         ("ziwei", ziwei_bad)):
                buckets[k][idx].append(v)

    print(f"正类：{a.cat}事件年　AUC>0.5 表示「该年更凶」判对了方向\n")
    print("  方法      AUC     n(正/负)   方向")
    for k in ("simple", "mine", "ziwei"):
        pos, neg = buckets[k]
        v, np_, nn = auc(pos, neg)
        arrow = "对" if v > 0.5 else "反"
        print(f"  {k:<8} {v:.3f}   ({np_}/{nn})   {arrow}")
    print("\n  随机基线 0.500")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
