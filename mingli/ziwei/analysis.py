"""Zi Wei Dou Shu interpretation: 三方四正, 格局, 大限 / 流年."""

from __future__ import annotations

from dataclasses import dataclass

from ..calendar.ganzhi import GAN, ZHI
from .chart import (BRIGHT_SCORE, HUA_NAMES, LUCKY, MAJOR_STARS, PALACE_NAMES,
                    SIHUA_SANHE, STAR_EN, UNLUCKY, ZiweiChart)

OPPOSITE = 6   # 對宮 offset in palace index

PATTERN_BONUS = {
    "極向離明": 8.0, "君臣慶會": 7.0, "紫府朝垣": 6.0, "月朗天門": 5.0,
    "日照雷門": 5.0, "石中隱玉": 4.0, "英星入廟": 3.0, "機月同梁": 3.0,
    "殺破狼": 2.0, "命無正曜": -4.0,
}

PATTERNS = [
    ("紫府朝垣", "紫微与天府分居命、财、官三合，主格局宽厚、资源聚合"),
    ("君臣庆会", "紫微坐命而左辅右弼、天魁天钺同会，主贵人成群的领导格"),
    ("杀破狼", "七杀、破军、贪狼三方会照，主一生起伏大、宜开创不宜守成"),
    ("机月同梁", "天机、太阴、天同、天梁会照，主谋略与文职，宜幕僚与专业"),
    ("月朗天门", "太阴在亥坐命，主聪慧阴柔、宜夜间与远方发展"),
    ("日照雷门", "太阳在卯坐命，主光明外向、早年得志"),
    ("石中隐玉", "巨门在子或午坐命，主口才与研究，先苦后甘"),
    ("极向离明", "紫微在午坐命，主格局最高，领袖之象"),
    ("英星入庙", "破军在子或午坐命，主敢破敢立、成败皆速"),
    ("命无正曜", "命宫无十四主星，借对宫安星，主性格随环境塑造"),
]

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
    ming = chart.palace("命宫")
    branches = {p.branch: p for p in chart.palaces}
    found = []
    majors_ming = {s.name for s in ming.major}
    tri = {ming.branch}
    for off in (-4, 4, 6):
        tri.add(ZHI[(ming.index + off) % 12])
    trio_majors = set()
    for b in tri:
        trio_majors |= {s.name for s in branches[b].major}

    def add(name):
        for n, desc in PATTERNS:
            if n == name:
                found.append({"name": n, "desc": desc})
                return

    if "紫微" in trio_majors and "天府" in trio_majors:
        add("紫府朝垣")
    if "紫微" in majors_ming:
        helpers = {s.name for s in ming.stars}
        for off in (-4, 4, 6):
            helpers |= {s.name for s in branches[ZHI[(ming.index + off) % 12]].stars}
        if {"左辅", "右弼"} & helpers and {"天魁", "天钺"} & helpers:
            add("君臣庆会")
        if ming.branch == "午":
            add("极向离明")
        if {"破軍"} & trio_majors:
            add("英星入庙")
    if {"七殺", "破軍", "貪狼"} <= trio_majors:
        add("杀破狼")
    if {"天機", "太陰", "天同", "天梁"} <= trio_majors:
        add("机月同梁")
    if "太陰" in majors_ming and ming.branch == "亥":
        add("月朗天门")
    if "太陽" in majors_ming and ming.branch == "卯":
        add("日照雷门")
    if "巨門" in majors_ming and ming.branch in ("子", "午"):
        add("石中隐玉")
    if not ming.major:
        add("命无正曜")
    seen, out = set(), []
    for f in found:
        if f["name"] not in seen:
            seen.add(f["name"])
            out.append(f)
    return out


@dataclass
class Decade:
    index: int
    branch: str
    palace: str
    start_age: int
    end_age: int
    start_year: int
    end_year: int
    theme: str
    advice: str
    score: float
    active: bool = False


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
    sc = max(2.0, min(98.0, sc + sum(PATTERN_BONUS.get(p["name"], 0) for p in pats)))
    cai = chart.palace("财帛")
    guan = chart.palace("官禄")
    cai_s, _ = palace_score(chart, cai)
    guan_s, _ = palace_score(chart, guan)
    return {
        "ming_score": round(sc, 1),
        "wealth_score": cai_s,
        "career_score": guan_s,
        "patterns": pats,
        "ming_stars": [f"{s.name}" + (f"化{s.hua}" if s.hua else "")
                       + (f"[{s.brightness}]" if s.brightness else "")
                       for s in ming.major],
        "ming_detail": detail,
        "body_palace": next((p.name for p in chart.palaces if p.is_body), ""),
    }
