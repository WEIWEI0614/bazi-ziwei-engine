"""Zi Wei Dou Shu interpretation: 三方四正, 格局, 大限 / 流年."""

from __future__ import annotations

from dataclasses import dataclass

from ..calendar.ganzhi import GAN, ZHI
from .chart import (BRIGHT_SCORE, HUA_NAMES, LUCKY, MAJOR_STARS, PALACE_NAMES,
                    SIHUA_SANHE, STAR_EN, UNLUCKY, ZiweiChart)

OPPOSITE = 6   # 對宮 offset in palace index

#: 格局对命宫分的加减。键必须用**简体**——旧表是繁体键（極向離明 / 殺破狼…），
#: 而格局名是简体，`get()` 一年到头都取不到值，等于格局从来没参与过评分。
#: 吉格按「结构有多难得」给分，凶格按「破得多重」扣分，中格不动。
PATTERN_BONUS = {
    "极向离明": 7.0, "紫府同宫": 7.0, "君臣庆会": 6.0, "紫府朝垣": 5.0,
    "府相朝垣": 5.0, "三奇嘉会": 6.0, "阳梁昌禄": 5.0, "日月并明": 5.0,
    "双禄交流": 4.0, "禄马交驰": 4.0, "日丽中天": 4.0, "日照雷门": 3.0,
    "月朗天门": 3.0, "石中隐玉": 3.0, "英星入庙": 3.0, "巨日同宫": 3.0,
    "文星拱命": 3.0, "左右夹命": 3.0, "魁钺夹命": 3.0, "日月夹命": 3.0,
    "紫府夹命": 3.0, "机月同梁": 2.0,
    "命无正曜": -2.0, "杀破狼": -2.0,
    "命里逢空": -6.0, "空劫夹命": -5.0, "火铃夹命": -5.0,
    "羊陀夹忌": -6.0, "刑忌夹印": -6.0, "日月反背": -5.0,
}

#: 格局表已移到 ziwei/patterns.py —— 那里是唯一实现，吉格凶格全列。
from .patterns import PATTERNS as _PATTERNS, detect as _detect   # noqa: E402

DECADE_THEMES = {
    "命宫": ("自我与方向", "以建立个人定位为主"),
    "兄弟": ("同辈与合作", "手足、伙伴、竞争者影响大"),
    "夫妻": ("亲密关系", "婚恋与长期合作为主题"),
    "子女": ("创造与培育", "子女、创作、投资标的"),
    "财帛": ("资源与现金流", "收入结构与理财"),
    "疾厄": ("身体与压力", "健康、情绪与消耗"),
    "迁移": ("外部环境", "出行、异地、外部机会"),
    "仆役": ("人脉与团队", "朋友、下属、社群"),
    "官禄": ("事业与职位", "职业发展与社会角色"),
    "田宅": ("根基与资产", "房产、家庭、内部安定"),
    "福德": ("精神与享受", "心态、兴趣、生活品质"),
    "父母": ("长辈与制度", "父母、上司、体制"),
}


def palace_score(chart: ZiweiChart, palace) -> tuple[float, dict]:
    """Score a palace from its 三方四正 (self + opposite + two trines)."""
    idx = palace.index
    trio = [palace]
    for off in (-4, 4, OPPOSITE):
        for p in chart.palaces:
            if p.index == (idx + off) % 12:
                trio.append(p)
    comp = {"main": 0.0, "lucky": 0.0, "unlucky": 0.0, "hua": 0.0}
    detail = []
    for p in trio:
        weight = 1.0 if p is palace else 0.55
        for s in p.stars:
            if s.kind == "主星":
                v = BRIGHT_SCORE.get(s.brightness, 0.0)
                comp["main"] += v * weight
                detail.append(f"{p.name}·{s.name}({s.brightness or '—'})")
            elif s.name in LUCKY:
                comp["lucky"] += 1.6 * weight
                detail.append(f"{p.name}·{s.name}")
            elif s.name in UNLUCKY:
                comp["unlucky"] += 2.0 * weight
                detail.append(f"{p.name}·{s.name}✗")
            if s.hua == "禄":
                comp["hua"] += 2.0 * weight
            elif s.hua == "权":
                comp["hua"] += 1.2 * weight
            elif s.hua == "科":
                comp["hua"] += 1.4 * weight
            elif s.hua == "忌":
                comp["hua"] -= 2.4 * weight
    raw = comp["main"] * 1.0 + comp["lucky"] - comp["unlucky"] + comp["hua"]
    score = max(2.0, min(98.0, 50.0 + raw * 5.2))
    comp = {k: round(v, 2) for k, v in comp.items()}
    return round(score, 1), {"components": comp, "detail": detail}


def detect_patterns(chart: ZiweiChart) -> list[dict]:
    """全部格局，含未成立的。成立与否由 patterns.detect 判。"""
    return _detect(chart)


def pattern_hits(chart: ZiweiChart) -> list[str]:
    """只取成立的 —— 评分与摘要用这个，展示用全表。"""
    return [p["name"] for p in _detect(chart) if p["status"] == "成立"]

def decades(chart: ZiweiChart, as_of_year: int | None = None) -> list[Decade]:
    import datetime as _dt
    now = as_of_year or _dt.date.today().year
    out = []
    for k, p in enumerate(chart.palaces):
        s, e = p.decade
        sy = chart.birth.year + s - 1
        theme, advice = DECADE_THEMES.get(p.name, ("", ""))
        sc, _ = palace_score(chart, p)
        out.append(Decade(index=k, branch=p.branch, palace=p.name,
                          start_age=s, end_age=e, start_year=sy, end_year=sy + 9,
                          theme=theme, advice=advice, score=sc,
                          active=sy <= now <= sy + 9))
    return out


def yearly_palace(chart: ZiweiChart, year: int) -> dict:
    """流年命宮 = 該年地支所在之宮；並計算流年四化."""
    yidx = (year - 4) % 60
    yg = GAN[yidx % 10]
    yz = ZHI[yidx % 12]
    p = chart.by_branch(yz)
    hua = dict(zip(SIHUA_SANHE[yg], HUA_NAMES))
    landed = {}
    for pal in chart.palaces:
        for s in pal.stars:
            if s.name in hua:
                landed.setdefault(hua[s.name], []).append(f"{s.name}→{pal.name}({pal.branch})")
    base, _ = palace_score(chart, p)
    lh = sum(1.0 for v in landed.get("禄", []) if p.name in v)
    lj = sum(1.0 for v in landed.get("忌", []) if p.name in v)
    score = max(2.0, min(98.0, base + lh * 6 - lj * 8))
    return {
        "year": year, "ganzhi": yg + yz, "palace": p.name,
        "branch": p.branch, "score": round(score, 1),
        "si_hua": {k: v for k, v in landed.items()},
        "same_as": "本命命宮" if p.name == "命宫" else "",
    }


def summary(chart: ZiweiChart) -> dict:
    ming = chart.palace("命宫")
    sc, detail = palace_score(chart, ming)
    pats = detect_patterns(chart)
    # 格局本身是贵气，不能只看主星亮度
    hits = [p for p in pats if p["status"] == "成立"]
    sc = max(2.0, min(98.0, sc + sum(PATTERN_BONUS.get(p["name"], 0) for p in hits)))
    cai = chart.palace("财帛")
    guan = chart.palace("官禄")
    cai_s, _ = palace_score(chart, cai)
    guan_s, _ = palace_score(chart, guan)
    return {
        "ming_score": round(sc, 1),
        "wealth_score": cai_s,
        "career_score": guan_s,
        "patterns": pats,
        "patternHits": [x["name"] for x in pats if x["status"] == "成立"],
        "patternBad": [x["name"] for x in pats
                       if x["status"] == "成立" and x.get("tier") == "凶"],
        "ming_stars": [f"{s.name}" + (f"化{s.hua}" if s.hua else "")
                       + (f"[{s.brightness}]" if s.brightness else "")
                       for s in ming.major],
        "ming_detail": detail,
        "body_palace": next((p.name for p in chart.palaces if p.is_body), ""),
    }
