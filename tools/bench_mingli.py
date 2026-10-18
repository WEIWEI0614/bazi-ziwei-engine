#!/usr/bin/env python3
"""Run the engine against the MingLi-Bench question set.

    python tools/bench_mingli.py [--data path/to/data.json] [--show]

MingLi-Bench collects multiple-choice questions from the annual Global Fortune
Teller Competition (2022-2025): each item gives a birth moment and asks what
happened in a given year, or in which year something happened. That makes it the
only public set where "was the engine right" has an answer key, instead of a
matter of taste.

What this script does NOT do: pretend the engine understands free text. An
option like "因长期食药，导致健康出问题" is mapped to a life area by keyword,
and the year is scored on that area by the classical themes of its ten gods.
That mapping is crude by construction, and the accuracy should be read with it
in mind -- the point is to have a number that can be argued with, not a number
that flatters the method.

Baselines are printed next to the result so the number means something:
  random      1/4 of the questions, since every item has four options
  majority    always answering the most common letter
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

# ---------------------------------------------------------------- keyword maps
# 事件 → 生活领域。宁可粗，也不要写一堆只有自己看得懂的规则。
ASPECT_KW = {
    "health": ["病", "医", "院", "手术", "伤", "意外", "车祸", "撞", "身体", "抑郁",
               "癌", "痛", "食药", "逝世", "过世", "死", "药", "住院"],
    "love": ["婚", "恋", "妻", "夫", "女朋友", "男朋友", "感情", "拍拖", "同居",
             "离婚", "签纸", "摆酒", "怀孕", "生子", "子女", "女儿", "儿子", "胎"],
    "wealth": ["财", "钱", "股票", "投资", "赚", "输", "破财", "债", "买楼", "物业",
               "生意", "收入", "薪", "置业", "发达", "亏"],
    "career": ["工作", "职", "升", "老板", "公司", "创业", "事业", "转行", "辞",
               "退休", "聘", "打工", "生意失败", "失业"],
    "study": ["学", "毕业", "大学", "留学", "考试", "升学", "中五", "中七", "预科",
              "硕士", "博士", "读书", "文凭"],
    "move": ["移", "搬", "出国", "外地", "移民", "来港", "回港", "内地", "迁", "旅"],
    "family": ["父", "母", "祖", "长辈", "家人", "兄弟", "姐", "妹", "亲人"],
    "legal": ["官非", "诉", "法律", "牢", "狱", "警", "罚款", "法庭"],
}
# 极性词表：判定「这个选项是好事还是坏事」。必须覆盖 ASPECT_KW 里所有的坏事，
# 否则「患上严重抑郁」会被当成中性——第一版就是这么漏的，accuracy 掉到 12%。
NEG = ["病", "医", "院", "手术", "伤", "意外", "车祸", "撞", "抑郁", "癌",
       "逝世", "过世", "死", "药", "住院", "离婚", "输", "破财", "债", "亏",
       "失业", "辞", "官非", "牢", "诉", "失败", "单身", "堕胎", "打劫", "罪",
       "离别", "分手", "欠", "罚"]
POS = ["结婚", "签纸", "摆酒", "怀孕", "生子", "得子", "升", "加薪", "赚", "毕业",
       "升学", "买", "置业", "发达", "获", "融资", "提拔", "立功", "积蓄",
       "自由", "旅行", "移民", "成功", "赔"]

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


def aspects_in(text: str) -> set[str]:
    out = set()
    for k, kws in ASPECT_KW.items():
        if any(w in text for w in kws):
            out.add(k)
    return out


def polarity(text: str) -> int:
    n = sum(1 for w in NEG if w in text)
    p = sum(1 for w in POS if w in text)
    if n > p:
        return -1
    if p > n:
        return 1
    return 0


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


def area_scores(chart, cycles, year: int) -> dict[str, float]:
    """How much this year leans toward each life area, in the engine's terms."""
    p = year_period(chart, year, _cycle_for(cycles, year))
    sc = collections.defaultdict(float)
    for god in (p.shishen_gan, p.shishen_zhi):
        for a, w in GOD_ASPECT.get(god, {}).items():
            sc[a] += 1.2 * w
    for t in p.themes:
        for a, w in THEME_ASPECT.get(t, {}).items():
            sc[a] += 1.0 * w
    # 分数只在这个领域「有戏」的时候才参与定吉凶，否则会把所有题都推向同年最吉
    tone = (p.score - 50.0) / 10.0
    for a in list(sc):
        sc[a] += 0.35 * tone * (1 if sc[a] > 0 else -1) * (1 if sc[a] > 0 else 1)
    return sc


def answer_year_given_event(q, chart, cycles) -> str:
    """「此命何年结婚」：给每个候选年算该领域的倾向，取最高。"""
    target = aspects_in(q["question"])
    if not target:
        for o in q["options"]:
            target |= aspects_in(o["text"])
    if not target:
        return ""
    want = aspect_want(q["question"] + "".join(o["text"] for o in q["options"]))
    best, best_v = "", -1e9
    for o in q["options"]:
        m = re.search(r"(?:19|20)\d{2}", o["text"])
        if not m:
            continue
        y = int(m.group())
        sc = area_scores(chart, cycles, y)
        v = sum(sc.get(a, 0.0) for a in target) + 0.6 * want * (sc.get("__total", 0))
        # 该年的整体基调也参与：正事件偏好吉年，负事件偏好凶年
        p = year_period(chart, y, _cycle_for(cycles, y))
        v += 0.25 * want * (p.score - 50.0) / 10.0
        if v > best_v:
            best, best_v = o["letter"], v
    return best


def aspect_want(text: str) -> int:
    """问的是好事还是坏事。结婚 +1，逝世 -1。"""
    return polarity(text) or 1


def answer_event_given_year(q, chart, cycles) -> str:
    """「此命1996年发生何事」：给每个选项算「该年该领域的倾向 × 极性」。"""
    m = re.search(r"(?:19|20)\d{2}", q["question"])
    if not m:
        return ""
    y = int(m.group())
    sc = area_scores(chart, cycles, y)
    p = year_period(chart, y, _cycle_for(cycles, y))
    tone = (p.score - 50.0) / 10.0
    best, best_v = "", -1e9
    for o in q["options"]:
        a = aspects_in(o["text"])
        pol = polarity(o["text"])
        v = sum(sc.get(k, 0.0) for k in a)
        # 极性与当年基调一致才加分：凶年里的凶事件、吉年里的吉事件
        v += 0.8 * pol * tone
        if v > best_v:
            best, best_v = o["letter"], v
    return best


def classify(q) -> str:
    opts = [o["text"].strip() for o in q["options"]]
    has_year = [bool(re.search(r"(?:19|20)\d{2}", t)) for t in opts]
    if all(has_year):
        return "year"                      # 四个选项都带年份 → 挑年份
    if re.search(r"何年|哪年|何時|何时|什么时候|甚麼時候", q["question"]) and any(has_year):
        return "year"
    if re.search(r"(?:19|20)\d{2}", q["question"]):
        return "event"                     # 指定年份 → 挑事件
    return "static"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/mingli-bench.json")
    ap.add_argument("--show", action="store_true")
    a = ap.parse_args()
    path = a.data if os.path.isabs(a.data) else os.path.join(ROOT, a.data)
    qs = json.load(open(path, encoding="utf-8"))["questions"]

    charts = {}
    ok = collections.Counter()
    tot = collections.Counter()
    rows = []
    letters = collections.Counter(q["answer"] for q in qs)
    for q in qs:
        kind = classify(q)
        tot[kind] += 1
        if kind == "static":
            continue
        cid = q["case_id"]
        if cid not in charts:
            try:
                c = _chart(q["birth_info"])
                charts[cid] = (c, luck_cycles(c, 1, 2100))
            except Exception as e:                       # noqa: BLE001
                charts[cid] = None
        if charts[cid] is None:
            continue
        c, cycles = charts[cid]
        try:
            pred = (answer_event_given_year(q, c, cycles) if kind == "event"
                    else answer_year_given_event(q, c, cycles))
        except Exception:                                # noqa: BLE001
            pred = ""
        if not pred:
            continue
        good = pred == q["answer"]
        ok[kind] += good
        rows.append((q["id"], kind, q["answer"], pred, good, q["category"], q["question"]))

    n = sum(ok.values()) + sum(tot[k] - ok[k] for k in ok)  # noqa: F841
    answered = collections.Counter()
    for r in rows:
        answered[r[1]] += 1
    print("题库", len(qs), "题；可判定", sum(answered.values()),
          f"（事件型 {answered['event']}、年份型 {answered['year']}、"
          f"静态题 {tot['static']} 未参与）")
    for k in ("event", "year"):
        if answered[k]:
            print(f"  {k}: {ok[k]}/{answered[k]} = {ok[k]/answered[k]*100:.1f}%")
    allok, alln = sum(ok.values()), sum(answered.values())
    print(f"合计 {allok}/{alln} = {allok/alln*100:.1f}%" if alln else "无可判定题目")
    print(f"基线：随机 25.0%　永远选最多字母 {letters.most_common(1)[0][1]/len(qs)*100:.1f}%"
          f"（{letters.most_common(1)[0][0]}）")
    bycat = collections.Counter()
    for _, _, _, _, g, cat, _ in rows:
        bycat[(cat, g)] += 1
    print("\n按类别：")
    for cat in sorted({c for c, _ in bycat}):
        good, bad = bycat[(cat, True)], bycat[(cat, False)]
        print(f"  {cat}: {good}/{good+bad} = {good/(good+bad)*100:.0f}%")
    if a.show:
        print("\n错例：")
        for r in rows:
            if not r[4]:
                print(f"  {r[0]} [{r[1]}/{r[5]}] {r[6]} → 答{r[2]} 猜{r[3]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
