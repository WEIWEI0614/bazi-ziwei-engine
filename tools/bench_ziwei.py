#!/usr/bin/env python3
"""Test the Zi Wei annual method that commercial apps actually use.

    python tools/bench_ziwei.py

The bazi score in this repo is one person's weighting of five components. A
fair objection is "maybe your weights are wrong, not the method". So this
script implements the method the paid apps describe in their own guides —
three layers (natal, decade, year), four transformations landing in palaces,
and the year palace overlapping a natal palace — and tests it on the same 50
public figures with the same metric.

The claim being tested is narrow and classical:

  when the annual transformation (禄/权/科/忌) lands in a palace, that palace's
  life area gets *activated* that year — something happens there.

Activation is tested on its own (`act`), without asking whether the event was
good or bad, because 禄 vs 忌 points at direction, not at whether anything
happens. Direction is tested separately (`signed`).

Reported as AUC against the same person's quiet years: 0.5 is nothing.
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

from mingli.bazi.chart import build_chart      # noqa: E402
from mingli.ziwei.chart import build_ziwei     # noqa: E402
from mingli.calendar.ganzhi import GAN, ZHI    # noqa: E402
from tools.bench_celebrity import auc          # noqa: E402

# 事件类别 → 本命宫
PALACE_OF = {"感情": "夫妻", "财富": "财帛", "事业": "官禄", "健康": "疾厄", "六亲": "父母"}
# 四化 → 方向与强度（禄权科为吉，忌为凶）
HUA_DIR = {"禄": 1.0, "权": 0.6, "科": 0.4, "忌": -1.0}


def _sihua_table():
    from mingli.ziwei.analysis import SIHUA_SANHE, HUA_NAMES
    return SIHUA_SANHE, HUA_NAMES


def year_huas(chart, year: int):
    """流年四化 → {宫名: [(星, 化, 方向)]}"""
    SIHUA_SANHE, HUA_NAMES = _sihua_table()
    yg = GAN[(year - 4) % 60 % 10]
    stars = SIHUA_SANHE[yg]
    out = collections.defaultdict(list)
    for star, hua in zip(stars, HUA_NAMES):
        for pal in chart.palaces:
            for s in pal.stars:
                if s.name == star:
                    out[pal.name].append((star, hua, HUA_DIR[hua]))
    return out, yg


def annual_features(chart, year: int):
    """每年给每个领域两个数：引动强度 / 吉凶方向。"""
    huas, yg = year_huas(chart, year)
    yz = ZHI[(year - 4) % 60 % 12]
    feats = {}
    try:
        year_palace = chart.by_branch(yz)
    except Exception:                       # noqa: BLE001
        year_palace = None
    for cat, pal in PALACE_OF.items():
        act = 0.0
        signed = 0.0
        for star, hua, d in huas.get(pal, []):
            act += 1.0
            signed += d
        # 流年命宫落在此宫：这一年的事绕着这个宫转。这是最常被引用的
        # 「应期」判法（流年命宫叠本命夫妻宫 → 结婚），单独留一个 0/1 特征
        hit = 1.0 if (year_palace is not None and year_palace.name == pal) else 0.0
        if hit:
            act += 1.0
            signed += 0.5
        feats[cat] = (act, signed, hit)
    return feats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/celeb50.json")
    ap.add_argument("--min-age", type=int, default=16)
    ap.add_argument("--max-age", type=int, default=85)
    a = ap.parse_args()
    path = a.data if os.path.isabs(a.data) else os.path.join(ROOT, a.data)
    people = json.load(open(path, encoding="utf-8"))

    buckets = collections.defaultdict(lambda: ([], []))   # (feat, cat) -> (pos, neg)
    ok = 0

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
        except Exception:                        # noqa: BLE001
            continue
        ok += 1
        birth = int(b["year"])
        by_year = collections.defaultdict(set)
        for cat, items in person["categories"].items():
            for it in items:
                m = re.search(r"(?:19|20)\d{2}", it)
                if m:
                    y = int(m.group())
                    if birth + a.min_age <= y <= birth + a.max_age:
                        by_year[y].add(cat)
        if not by_year:
            continue
        for y in range(birth + a.min_age, birth + a.max_age + 1):
            f = annual_features(z, y)
            here = by_year.get(y, set())
            for cat in PALACE_OF:
                act, signed, hit = f[cat]
                buckets[("act", cat)][0 if cat in here else 1].append(act)
                buckets[("signed", cat)][0 if cat in here else 1].append(signed)
                buckets[("hit", cat)][0 if cat in here else 1].append(hit)

    print(f"案例 {ok}　年龄 {a.min_age}-{a.max_age}　AUC 0.5 = 无信号\n")
    print(" 特征      类别    AUC     n(正/负)   说明")
    for feat in ("hit", "act", "signed"):
        for cat in PALACE_OF:
            pos, neg = buckets[(feat, cat)]
            v, np_, nn = auc(pos, neg)
            note = {"hit": "流年命宫叠本宫", "act": "四化引动", "signed": "吉凶方向"}[feat]
            flag = "  ←" if v >= 0.55 else ""
            print(f" {feat:<9} {cat:<5} {v:.3f}   ({np_}/{nn})   {note}{flag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
