#!/usr/bin/env python3
"""Run the engine against the MingLi-Bench question set.

    python tools/bench_mingli.py [--data path] [--sweep]

MingLi-Bench collects multiple-choice questions from the annual Global Fortune
Teller Competition (2022-2025): each gives a birth moment and asks what happened
in a given year, or in which year something happened. It is the only public set
where "was the engine right" has an answer key instead of an opinion.

Two ways of feeding the options in:

  labels (default)  each option is annotated by hand as (life area, good/bad).
                    This measures the ENGINE: the only thing left unknown is
                    whether the chart knows what happened.
  keywords (--kw)   options are mapped with the keyword table below. This
                    measures the TABLE, and is kept because the gap between the
                    two numbers is exactly how much the mapping costs.

A question is skipped when the engine could not answer it even with perfect
labels -- "which organ was operated on" is not something a chart states. Those
are marked ok=false in the label files, not removed silently.
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

from mingli.bazi.chart import build_chart           # noqa: E402
from mingli.bazi.luck import luck_cycles, year_period  # noqa: E402

# 十神 → 领域（古法：财为妻财、官杀为职位压力、印为文书长辈、食伤为输出子女）
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

# 只给 --kw 模式用
ASPECT_KW = {
    "health": ["病", "医", "院", "手术", "伤", "意外", "车祸", "撞", "身体", "抑郁",
               "癌", "痛", "食药", "逝世", "过世", "死", "药", "住院"],
    "love": ["婚", "恋", "妻", "夫", "女朋友", "男朋友", "感情", "拍拖", "同居",
             "离婚", "签纸", "摆酒", "怀孕", "生子", "子女", "女儿", "儿子", "胎"],
    "wealth": ["财", "钱", "股票", "投资", "赚", "输", "破财", "债", "买楼", "物业",
               "生意", "收入", "薪", "置业", "发达", "亏"],
    "career": ["工作", "职", "升", "老板", "公司", "创业", "事业", "转行", "辞",
               "退休", "聘", "打工", "失业"],
    "study": ["学", "毕业", "大学", "留学", "考试", "升学", "中五", "中七", "预科",
              "硕士", "博士", "读书", "文凭"],
    "move": ["移", "搬", "出国", "外地", "移民", "来港", "回港", "内地", "迁", "旅"],
    "family": ["父", "母", "祖", "长辈", "家人", "兄弟", "姐", "妹", "亲人"],
    "legal": ["官非", "诉", "法律", "牢", "狱", "警", "罚款", "法庭"],
}
NEG = ["病", "医", "院", "手术", "伤", "意外", "车祸", "撞", "抑郁", "癌",
       "逝世", "过世", "死", "药", "住院", "离婚", "输", "破财", "债", "亏",
       "失业", "辞", "官非", "牢", "诉", "失败", "单身", "堕胎", "打劫", "罪",
       "离别", "分手", "欠", "罚"]
POS = ["结婚", "签纸", "摆酒", "怀孕", "生子", "得子", "升", "加薪", "赚", "毕业",
       "升学", "买", "置业", "发达", "获", "融资", "提拔", "立功", "积蓄",
       "自由", "旅行", "移民", "成功", "赔"]


def aspects_in(text: str) -> set[str]:
    return {k for k, kws in ASPECT_KW.items() if any(w in text for w in kws)}


def polarity(text: str) -> int:
    n = sum(1 for w in NEG if w in text)
    p = sum(1 for w in POS if w in text)
    return -1 if n > p else (1 if p > n else 0)


def _chart(b: dict):
    return build_chart("bench", "male" if b.get("gender") == "男" else "female",
                       int(b["year"]), int(b["month"]), int(b["day"]),
                       int(b["hour"]), int(b.get("minute") or 0),
                       longitude=116.4, use_true_solar=False)


def _cycle_for(cycles, year):
    for c in cycles:
        if c.start_year <= year <= c.end_year:
            return c
    return None


def area_scores(chart, cycles, year: int):
    """How much this year leans toward each life area, plus its overall tone.

    Kept pure: the tone does not leak into the per-area scores, because the
    caller decides how much a good or bad year should count (see `lam`).
    """
    p = year_period(chart, year, _cycle_for(cycles, year))
    sc = collections.defaultdict(float)
    for god in (p.shishen_gan, p.shishen_zhi):
        for a, w in GOD_ASPECT.get(god, {}).items():
            sc[a] += 1.2 * w
    for t in p.themes:
        for a, w in THEME_ASPECT.get(t, {}).items():
            sc[a] += 1.0 * w
    return sc, p.score


def classify(q) -> str:
    opts = [o["text"].strip() for o in q["options"]]
    has_year = [bool(re.search(r"(?:19|20)\d{2}", t)) for t in opts]
    if all(has_year):
        return "year"
    if re.search(r"何年|哪年|何時|何时|什么时候|甚麼時候", q["question"]) and any(has_year):
        return "year"
    if re.search(r"(?:19|20)\d{2}", q["question"]):
        return "event"
    return "static"


def predict_event(q, chart, cycles, opt_label, lam) -> str:
    m = re.search(r"(?:19|20)\d{2}", q["question"])
    if not m:
        return ""
    sc, score = area_scores(chart, cycles, int(m.group()))
    tone = (score - 50.0) / 10.0
    best, bv = "", -1e9
    for o in q["options"]:
        lb = opt_label(o)
        if lb is None:
            continue
        d, pol = lb
        v = sum(sc[a] for a in d) + lam * pol * tone
        if v > bv:
            best, bv = o["letter"], v
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/mingli-bench.json")
    ap.add_argument("--sweep", action="store_true", help="scan the tone weight")
    ap.add_argument("--kw", action="store_true", help="use the keyword table instead of labels")
    ap.add_argument("--show", action="store_true")
    a = ap.parse_args()

    def p(rel):
        return rel if os.path.isabs(rel) else os.path.join(ROOT, rel)

    qs = json.load(open(p(a.data), encoding="utf-8"))["questions"]
    lev = json.load(open(p("data/mlb-labels-event.json"), encoding="utf-8"))
    lyer = json.load(open(p("data/mlb-labels-year.json"), encoding="utf-8"))

    charts, rows = {}, []

    def get_chart(q):
        cid = q["case_id"]
        if cid not in charts:
            try:
                c = _chart(q["birth_info"])
                charts[cid] = (c, luck_cycles(c, 1, 2100))
            except Exception:                       # noqa: BLE001
                charts[cid] = None
        return charts[cid]

    def run(lam: float, kw: bool):
        rows = []
        for q in qs:
            kind = classify(q)
            if kind == "static":
                continue
            got = get_chart(q)
            if not got:
                continue
            c, cy = got
            if kw:
                if kind == "event":
                    ol = lambda o: (sorted(aspects_in(o["text"])), polarity(o["text"]))  # noqa: E731
                else:
                    txt = q["question"] + "".join(o["text"] for o in q["options"])
                    area = sorted(aspects_in(txt))
                    pol = polarity(txt) or 1
                    ol = lambda o, area=area, pol=pol: (area, pol)  # noqa: E731
                pred = (predict_event(q, c, cy, ol, lam) if kind == "event"
                        else _year_with(ol, q, c, cy, lam))
            else:
                lab = lev.get(q["id"]) if kind == "event" else lyer.get(q["id"])
                if not lab or not lab.get("ok"):
                    continue
                if kind == "event":
                    opts = lab["opts"]
                    ol = lambda o, opts=opts: ((opts[o["letter"]]["d"], opts[o["letter"]]["p"])
                                               if o["letter"] in opts else None)  # noqa: E731
                    pred = predict_event(q, c, cy, ol, lam)
                else:
                    area, pol = lab["d"], lab["p"]
                    ol = lambda o, area=area, pol=pol: (area, pol)  # noqa: E731
                    pred = _year_with(ol, q, c, cy, lam)
            if pred:
                rows.append((q["id"], kind, q["answer"], pred, pred == q["answer"],
                             q["category"], q["question"]))
        return rows

    if a.sweep:
        print("λ 扫描（λ 是「当年吉凶」在选项排序里的权重，0 = 只看领域）\n")
        print("  λ     event        year         total")
        for lam in (0.0, 0.25, 0.5, 1.0, 2.0, 4.0):
            rr = run(lam, a.kw)
            ev = [r for r in rr if r[1] == "event"]
            yr = [r for r in rr if r[1] == "year"]
            f = lambda xs: f"{sum(r[4] for r in xs)}/{len(xs)}={sum(r[4] for r in xs)/len(xs)*100:4.1f}%" if xs else "—"  # noqa: E731
            print(f"  {lam:<4} {f(ev):<12} {f(yr):<11} {sum(r[4] for r in rr)}/{len(rr)}="
                  f"{sum(r[4] for r in rr)/len(rr)*100:.1f}%")
        return 0

    rows = run(1.0, a.kw)
    ev = [r for r in rows if r[1] == "event"]
    yr = [r for r in rows if r[1] == "year"]
    print(f"模式：{'关键词表' if a.kw else '人工标注'}　可判定 {len(rows)} 题"
          f"（事件 {len(ev)}、年份 {len(yr)}）")
    for nm, xs in (("event", ev), ("year", yr)):
        if xs:
            k = sum(r[4] for r in xs)
            print(f"  {nm}: {k}/{len(xs)} = {k/len(xs)*100:.1f}%")
    k = sum(r[4] for r in rows)
    print(f"合计 {k}/{len(rows)} = {k/len(rows)*100:.1f}%　（随机 25%）")
    bycat = collections.Counter()
    for _, _, _, _, g, cat, _ in rows:
        bycat[(cat, g)] += 1
    print("\n按类别：")
    for cat in sorted({c for c, _ in bycat}):
        g, b = bycat[(cat, True)], bycat[(cat, False)]
        print(f"  {cat}: {g}/{g+b} = {g/(g+b)*100:.0f}%")
    if a.show:
        print("\n错例：")
        for r in rows:
            if not r[4]:
                print(f"  {r[0]} [{r[1]}/{r[5]}] {r[6]} → 答{r[2]} 猜{r[3]}")
    return 0


def _year_with(opt_label, q, chart, cycles, lam) -> str:
    d, pol = opt_label(None)
    best, bv = "", -1e9
    for o in q["options"]:
        m = re.search(r"(?:19|20)\d{2}", o["text"])
        if not m:
            continue
        y = int(m.group())
        sc, score = area_scores(chart, cycles, y)
        tone = (score - 50.0) / 10.0
        v = sum(sc[x] for x in d) + lam * pol * tone
        if v > bv:
            best, bv = o["letter"], v
    return best


if __name__ == "__main__":
    raise SystemExit(main())
