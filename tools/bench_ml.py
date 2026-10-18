#!/usr/bin/env python3
"""Can a model learn this, where hand-tuned weights failed?

    python tools/bench_ml.py [--cat 健康] [--perm 200]

The earlier benchmarks asked whether *a particular formula* ranks years well.
This one asks a different question: is there any learnable signal at all? If a
fitted model cannot beat age — the most obvious real-world predictor of when
things happen — then the chart is carrying no information about that year, no
matter how the weights are chosen.

Setup:
  50 public figures x ~60 years, labelled by whether an event of a given category
  happened that year (BaziQA celebrity50).

  features   the engine's own quantities (score, clash strength, ten-god valence,
             useful-element hit, decade tone, shensha), plus Zi Wei (year palace
             overlap, transformations landing in the year palace), plus the
             Later-Heaven trigram of the year palace, plus age as a control.
  model      L2 logistic regression, written here so the repo keeps no
             dependencies. Features are standardised on the training fold only.
  split      leave-one-person-out. Splitting by year would leak: the same person's
             adjacent years are near-duplicates.

Reported as AUC per feature set, plus a permutation test on the best one: labels
shuffled within each person, refit, and the AUC distribution that produces.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from mingli.bazi.chart import build_chart              # noqa: E402
from mingli.bazi.luck import luck_cycles, year_period  # noqa: E402
from mingli.ziwei.chart import build_ziwei             # noqa: E402
from tools.bench_ziwei import annual_features          # noqa: E402
from tools.bench_celebrity import auc                  # noqa: E402

# 后天八卦：支 → 卦
TRIGRAM = {"子": 1, "丑": 2, "寅": 2, "卯": 3, "辰": 4, "巳": 4,
           "午": 5, "未": 6, "申": 6, "酉": 7, "戌": 8, "亥": 8}
# 阳卦：乾坎艮震；阴卦：巽离坤兑
YANG_TRIGRAM = {1, 2, 3, 8}


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def fit_logreg(X, y, l2=1.0, iters=400, lr=0.5):
    """Small L2 logistic regression. Returns weights; intercept is unpenalised."""
    n, d = X.shape
    w = np.zeros(d)
    b = 0.0
    for _ in range(iters):
        p = sigmoid(X @ w + b)
        g = X.T @ (p - y) / n
        gb = float(np.mean(p - y))
        w -= lr * (g + l2 * w / n)
        b -= lr * gb
    return w, b


def build_rows(people, cat, min_age=16, max_age=85):
    rows = []
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
        except Exception:                          # noqa: BLE001
            continue
        cycles = luck_cycles(c, 1, 2100)
        birth = int(b["year"])
        hits = set()
        for it in person["categories"].get(cat, []):
            m = re.search(r"(?:19|20)\d{2}", it)
            if m and birth + min_age <= int(m.group()) <= birth + max_age:
                hits.add(int(m.group()))
        if not hits:
            continue
        pid = person["person_id"]
        for y in range(birth + min_age, birth + max_age + 1):
            p = year_period(c, y, next((x for x in cycles if x.start_year <= y <= x.end_year), None))
            zf = annual_features(z, y)
            trig = TRIGRAM.get(zf_trigger_branch(z, y), 0)
            rows.append({
                "pid": pid,
                "y": 1 if y in hits else 0,
                "age": y - birth,
                "score": p.score,
                "absrel": abs(p.components.get("冲合", 0.0)),
                "rel": p.components.get("冲合", 0.0),
                "god": p.components.get("十神", 0.0),
                "useful": p.components.get("用神", 0.0),
                "tone": p.components.get("大运", 0.0),
                "ss": p.components.get("神煞", 0.0),
                "zw_hit": zf[cat][2],
                "zw_act": zf[cat][0],
                "trig": trig,
                "trig_yang": 1.0 if trig in YANG_TRIGRAM else 0.0,
                "trig_x_age": (trig if trig in YANG_TRIGRAM else -trig) * (y - birth) / 60.0,
            })
    return rows


def zf_trigger_branch(chart, year):
    """流年命宫的地支 = 该年地支。"""
    from mingli.calendar.ganzhi import ZHI
    return ZHI[(year - 4) % 60 % 12]


SETS = {
    "age": ["age"],
    "bazi": ["score", "absrel", "rel", "god", "useful", "tone", "ss"],
    "ziwei": ["zw_hit", "zw_act"],
    "trigram": ["trig", "trig_yang"],
    "bazi+ziwei": ["score", "absrel", "rel", "god", "useful", "tone", "ss", "zw_hit", "zw_act"],
    "all": ["score", "absrel", "rel", "god", "useful", "tone", "ss",
            "zw_hit", "zw_act", "trig", "trig_yang", "trig_x_age"],
    "all+age": ["score", "absrel", "rel", "god", "useful", "tone", "ss",
                "zw_hit", "zw_act", "trig", "trig_yang", "trig_x_age", "age"],
}


def loo_person(rows, feats, l2=1.0):
    pids = sorted({r["pid"] for r in rows})
    preds = np.zeros(len(rows))
    for pid in pids:
        tr = [i for i, r in enumerate(rows) if r["pid"] != pid]
        te = [i for i, r in enumerate(rows) if r["pid"] == pid]
        Xtr = np.array([[rows[i][f] for f in feats] for i in tr], dtype=float)
        ytr = np.array([rows[i]["y"] for i in tr], dtype=float)
        Xte = np.array([[rows[i][f] for f in feats] for i in te], dtype=float)
        mu, sd = Xtr.mean(0), Xtr.std(0)
        sd[sd == 0] = 1.0
        w, b = fit_logreg((Xtr - mu) / sd, ytr, l2=l2)
        preds[te] = sigmoid(((Xte - mu) / sd) @ w + b)
    y = [r["y"] for r in rows]
    pos = [preds[i] for i, v in enumerate(y) if v]
    neg = [preds[i] for i, v in enumerate(y) if not v]
    return auc(pos, neg)[0]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/celeb50.json")
    ap.add_argument("--cat", default="健康")
    ap.add_argument("--perm", type=int, default=100)
    ap.add_argument("--perm-feat", type=int, default=0,
                    help="shuffle the chart features (keeping age) to see if they add anything")
    a = ap.parse_args()
    path = a.data if os.path.isabs(a.data) else os.path.join(ROOT, a.data)
    people = json.load(open(path, encoding="utf-8"))
    rows = build_rows(people, a.cat)
    npos = sum(r["y"] for r in rows)
    print(f"{len(people)} 人 · {len(rows)} 人年 · 正类 {npos}（{a.cat}事件年）")
    print("留一人交叉验证（同一人的年份绝不同时进训练与测试）\n")
    print("  特征集        AUC")
    best = ("", 0.0)
    for name, feats in SETS.items():
        v = loo_person(rows, feats)
        print(f"  {name:<12} {v:.3f}")
        if v > best[1]:
            best = (name, v)

    if a.perm:
        name, real = best
        print(f"\n置换检验（{name}，打乱每年标签、保留每人的事件率，重跑 {a.perm} 次）")
        rs = np.random.RandomState(20261018)
        base = [r["y"] for r in rows]
        by_pid = collections.defaultdict(list)
        for i, r in enumerate(rows):
            by_pid[r["pid"]].append(i)
        perm_aucs = []
        for _ in range(a.perm):
            for idx in by_pid.values():
                ys = [base[i] for i in idx]
                rs.shuffle(ys)
                for i, v in zip(idx, ys):
                    rows[i]["y"] = v
            perm_aucs.append(loo_person(rows, SETS[name]))
        for i, v in enumerate(base):     # 复原
            rows[i]["y"] = v
        perm_aucs = np.array(perm_aucs)
        p = float((perm_aucs >= real).mean())
        print(f"  真实 {real:.3f}　置换 中位 {np.median(perm_aucs):.3f} "
              f"95% {np.percentile(perm_aucs, 95):.3f}　p = {p:.3f}")
        print("  p 越小越说明「这个 AUC 不是碰巧」；p 大就是碰巧。")

    if a.perm_feat:
        name, real = "all+age", loo_person(rows, SETS["all+age"])
        cols = [f for f in SETS[name] if f != "age"]
        base_cols = {f: [r[f] for r in rows] for f in cols}
        rs = np.random.RandomState(20261019)
        aucs = []
        for _ in range(a.perm_feat):
            for f in cols:
                v = list(base_cols[f])
                rs.shuffle(v)
                for i, x in enumerate(v):
                    rows[i][f] = x
            aucs.append(loo_person(rows, SETS[name]))
        for f in cols:                          # 复原
            for i, x in enumerate(base_cols[f]):
                rows[i][f] = x
        aucs = np.array(aucs)
        p2 = float((aucs >= real).mean())
        print(f"\n命理特征增量检验（年龄保留，其余特征整体打乱，{a.perm_feat} 次）")
        print(f"  真实 {real:.3f}　打乱后 中位 {np.median(aucs):.3f} "
              f"95% {np.percentile(aucs, 95):.3f}　p = {p2:.3f}")
        print("  若真实值落在打乱分布里，说明换掉这些特征＝没有损失，它们没带信息。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
