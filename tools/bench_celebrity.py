#!/usr/bin/env python3
"""Do the engine's years line up with what actually happened to 50 public figures?

    python tools/bench_celebrity.py [--data data/celeb50.json] [--min-age 16]

The MingLi-Bench questions measure one thing: can the engine pick the right
option out of four. That is a hard, noisy test, and a wrong option-mapping can
sink it. This script measures something narrower and much cleaner:

  given a decade of years, do the years in which something happened to this
  person stand out from the years in which nothing did?

The data is `celebrity50_zh.json` from BaziQA: 50 public figures with exact
birth moments and 1,355 dated life events, filed under five headings (career,
wealth, health, romance, family). No option text, no keyword mapping — the
event's heading IS its life area.

Reported as AUC: the probability that a randomly chosen event-year scores
higher than a randomly chosen quiet year of the same person.

  0.50  no signal at all
  0.55  weak but real
  0.60  worth talking about

Two features per area are tested:

  signed    the engine's area score as-is. Tests "does the chart know this area
            went well or badly".
  |score|   its absolute value. Tests the weaker classical claim that an
            activated area shows up at all, good or bad.

A third line tests the same two questions on the year's overall score, and a
fourth on the strength of its clashes and combinations — the classical claim
that "big years are stirred years".
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

# 事件类别 → 引擎的领域名
CAT_AREA = {"感情": "love", "财富": "wealth", "健康": "health",
            "事业": "career", "六亲": "family"}
# 与 bench_mingli 保持一致：十神与主题对领域的贡献
GOD_ASPECT = {
    "正财": {"wealth": 1.0, "love": 0.6}, "偏财": {"wealth": 1.0, "love": 0.8},
    "正官": {"career": 1.0, "legal": 0.5}, "七杀": {"career": 0.8, "health": 0.5, "legal": 0.6},
    "正印": {"study": 1.0, "family": 0.6}, "偏印": {"study": 0.7, "health": 0.4},
    "食神": {"health": 0.4, "love": 0.5}, "伤官": {"career": 0.5, "legal": 0.4},
    "比肩": {"career": 0.3}, "劫财": {"wealth": -0.8, "career": 0.3},
}
THEME_ASPECT = {
    "同辈竞争": {"career": 0.6}, "合作与分利": {"career": 0.4, "wealth": 0.4},
    "自我主张": {"career": 0.3}, "合伙破财": {"wealth": -0.8}, "朋友借贷": {"wealth": -0.6},
    "冲动消费": {"wealth": -0.5}, "创作输出": {"career": 0.5, "study": 0.3},
    "口福与享受": {"health": 0.2}, "技术成名": {"career": 0.7},
    "突破常规": {"career": 0.6}, "口舌是非": {"legal": -0.6}, "才艺外显": {"career": 0.4},
    "意外之财": {"wealth": 0.9}, "副业与投机": {"wealth": 0.6}, "异性缘": {"love": 0.9},
    "正职收入": {"wealth": 0.7}, "稳健积累": {"wealth": 0.5}, "婚姻财务": {"love": 0.7, "wealth": 0.4},
    "压力与竞争": {"career": 0.5, "health": -0.4}, "权威挑战": {"legal": -0.5, "career": 0.4},
    "意外风险": {"health": -0.7}, "职位与名声": {"career": 0.9}, "制度约束": {"legal": -0.4},
    "责任加身": {"career": 0.5}, "偏门学问": {"study": 0.5}, "灵感与孤独": {"health": -0.2},
    "长辈助力": {"family": 0.6}, "学业与文书": {"study": 0.9}, "贵人庇护": {"career": 0.4},
    "名誉提升": {"career": 0.6},
}
AREAS = ("career", "wealth", "love", "health", "family", "study", "legal")


def area_scores(chart, cycles, year: int):
    p = year_period(chart, year, _cycle_for(cycles, year))
    sc = collections.defaultdict(float)
    for god in (p.shishen_gan, p.shishen_zhi):
        for a, w in GOD_ASPECT.get(god, {}).items():
            sc[a] += 1.2 * w
    for t in p.themes:
        for a, w in THEME_ASPECT.get(t, {}).items():
            sc[a] += 1.0 * w
    return sc, p


def _cycle_for(cycles, year):
    for c in cycles:
        if c.start_year <= year <= c.end_year:
            return c
    return None


def auc(pos: list[float], neg: list[float]) -> tuple[float, int, int]:
    """P(random positive scores above random negative), by rank sum."""
    if not pos or not neg:
        return float("nan"), len(pos), len(neg)
    allv = sorted([(v, 1) for v in pos] + [(v, 0) for v in neg])
    # 平均秩处理并列
    ranks = [0.0] * len(allv)
    i = 0
    while i < len(allv):
        j = i
        while j + 1 < len(allv) and allv[j + 1][0] == allv[i][0]:
            j += 1
        r = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[k] = r
        i = j + 1
    n_pos = len(pos)
    r_pos = sum(r for r, (v, lab) in zip(ranks, allv) if lab)
    u = r_pos - n_pos * (n_pos + 1) / 2
    return u / (n_pos * len(neg)), n_pos, len(neg)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/celeb50.json")
    ap.add_argument("--min-age", type=int, default=16)
    ap.add_argument("--max-age", type=int, default=85)
    a = ap.parse_args()
    path = a.data if os.path.isabs(a.data) else os.path.join(ROOT, a.data)
    people = json.load(open(path, encoding="utf-8"))

    feats = collections.defaultdict(lambda: collections.defaultdict(lambda: ([], [])))
    skipped = 0
    used_events = 0

    for person in people:
        b = person["profile"]["birth"]
        try:
            c = build_chart("bench", person["profile"]["gender"],
                            int(b["year"]), int(b["month"]), int(b["day"]),
                            int(b["hour"]), int(b.get("minute") or 0),
                            longitude=float(b.get("lon") or 116.4),
                            use_true_solar=False)
        except Exception:                              # noqa: BLE001
            skipped += 1
            continue
        cycles = luck_cycles(c, 1, 2100)
        birth = int(b["year"])

        # 事件年 → 类别集合
        by_year: dict[int, set[str]] = collections.defaultdict(set)
        for cat, items in person["categories"].items():
            for it in items:
                m = re.search(r"(?:19|20)\d{2}", it)
                if not m:
                    continue
                y = int(m.group())
                if birth + a.min_age <= y <= birth + a.max_age:
                    by_year[y].add(cat)
        if not by_year:
            continue
        used_events += sum(len(v) for v in by_year.values())

        years = list(range(birth + a.min_age, birth + a.max_age + 1))
        for y in years:
            sc, p = area_scores(c, cycles, y)
            rel = p.components.get("冲合", 0.0)
            row = {"__score": p.score, "__rel": rel, "__absrel": abs(rel)}
            for ar in AREAS:
                row[ar] = sc.get(ar, 0.0)
                row["|" + ar] = abs(sc.get(ar, 0.0))
            here = by_year.get(y, set())
            for k, v in row.items():
                # 每个类别单独做一次二分类：这一年该类有事 vs 没这事
                for cat in CAT_AREA:
                    feats[k][cat][0 if cat in here else 1].append(v)
                feats[k]["__any"][0 if here else 1].append(v)

    print(f"案例 {len(people)}（失败 {skipped}）　带年份事件 {used_events} 条")
    print(f"年龄窗口 {a.min_age}-{a.max_age}　AUC：0.50 无信号，0.55 弱，0.60 明显\n")

    def show(title, keys):
        print(title)
        print("  特征          事件年 vs 平常年      n(正/负)")
        for k in keys:
            for cat in sorted(feats[k], key=lambda x: (x != "__any", x)):
                pos, neg = feats[k][cat]
                v, np_, nn = auc(pos, neg)
                if np_ < 30 or nn < 30:
                    continue
                bar = "█" * int(max(0.0, (v - 0.4)) * 100 / 2)
                print(f"  {k:<12} {cat:<8} {v:.3f} {bar:<12} ({np_}/{nn})")
        print()

    show("① 整体分数", ["__score"])
    show("② 冲合强度（绝对值）", ["__absrel"])
    show("③ 分领域（带符号：吉凶方向）", list(AREAS))
    show("④ 分领域（绝对值：是否被引动）", ["|" + x for x in AREAS])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
