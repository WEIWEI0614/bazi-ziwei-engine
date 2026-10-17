"""Assemble a complete reading: chart + ziwei + scores + timelines + events."""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from .bazi import luck as bz_luck
from .bazi.chart import BaziChart, build_chart
from .calendar import astro
from .ziwei import analysis as zw_analysis
from .ziwei.chart import ZiweiChart, build_ziwei

DIM_LABELS = {
    "structure": ("结构格局", "Structure"),
    "flow": ("五行流通", "Element Flow"),
    "climate": ("调候得宜", "Climate Balance"),
    "ming": ("紫微命宫", "Ziwei Life Palace"),
    "sanfang": ("三方四正", "Trine & Opposite"),
    "yongshen": ("用神得力", "Useful God"),
}


def _entropy(weights: dict) -> float:
    import math
    vals = [v for v in weights.values() if v > 0]
    total = sum(vals) or 1
    h = -sum((v / total) * math.log(v / total) for v in vals)
    return h / math.log(5)


def score_overall(chart: BaziChart, zc: ZiweiChart) -> dict:
    es = chart.element_scores
    flow = _entropy(es) * 100                     # 0..100, higher = more even

    # 结构: 格局是否为特殊格 / 身强身弱是否落在 45-60 的可用区间
    st = chart.strength
    balance = max(0.0, 100.0 - abs(st - 52) * 3.2)
    struct = 0.55 * balance + 0.45 * (78 if chart.structure["kind"] == "特殊格" else 62)

    th = chart.tiaohou
    seq = th.get("sequence") or ""
    climate = 100.0 * (len(th.get("satisfied", [])) / max(1, len(seq))) if seq else 60.0
    climate = max(18.0, min(96.0, 40 + climate * 0.6))

    zsum = zw_analysis.summary(zc)
    ming = zsum["ming_score"]
    cai = zsum["wealth_score"]
    guan = zsum["career_score"]
    qian = zw_analysis.palace_score(zc, zc.palace("迁移"))[0]
    sanfang = round((ming * 0.4 + cai * 0.2 + guan * 0.2 + qian * 0.2), 1)

    favor, avoid, _ = bz_luck.useful_elements(chart)
    present = sum(es.get(f, 0) for f in favor)
    yongshen = max(8.0, min(96.0, present * 2.4))

    dims = {
        "structure": round(struct, 1),
        "flow": round(flow * 0.85 + 8, 1),
        "climate": round(climate, 1),
        "ming": round(ming, 1),
        "sanfang": sanfang,
        "yongshen": round(yongshen, 1),
    }
    weights = {"structure": 0.24, "flow": 0.12, "climate": 0.14,
               "ming": 0.26, "sanfang": 0.12, "yongshen": 0.12}
    overall = sum(dims[k] * weights[k] for k in dims)
    tier = ("上格" if overall >= 78 else "中上格" if overall >= 68 else
            "中格" if overall >= 56 else "中下格" if overall >= 44 else "下格")

    # 六领域
    ss = chart
    guan_sha = es.get([k for k in ("木", "火", "土", "金", "水")
                       if _ke(k) == chart.day_master_wx][0], 0)
    _ = guan_sha
    career = 0.45 * _shishen_score(ss, ("正官", "七杀", "食神", "伤官")) + 0.55 * guan
    wealth = 0.45 * _shishen_score(ss, ("正财", "偏财")) + 0.55 * cai
    love = 0.40 * _shishen_score(ss, ("正财", "正官", "偏财", "七杀")) \
        + 0.35 * sanfang + 0.25 * _zhi_health(ss, ss.day.zhi)
    health = 0.4 * (100 - abs(es.get(chart.day_master_wx, 0) - 25) * 2.2) \
        + 0.6 * zw_analysis.palace_score(zc, zc.palace("疾厄"))[0]
    study = 0.45 * _shishen_score(ss, ("正印", "偏印")) + 0.55 * ming
    social = 0.35 * _shishen_score(ss, ("比肩", "劫财")) \
        + 0.65 * zw_analysis.palace_score(zc, zc.palace("仆役"))[0]

    areas = {
        "career": round(min(96, max(6, career)), 1),
        "wealth": round(min(96, max(6, wealth)), 1),
        "love": round(min(96, max(6, love)), 1),
        "health": round(min(96, max(6, health)), 1),
        "study": round(min(96, max(6, study)), 1),
        "social": round(min(96, max(6, social)), 1),
    }
    return {"overall": round(overall, 1), "tier": tier, "dimensions": dims,
            "areas": areas, "weights": weights}


def _ke(el: str) -> str:
    from .calendar.ganzhi import KE
    return KE[el]


def _shishen_score(chart: BaziChart, gods: tuple) -> float:
    es = chart.element_scores
    dm = chart.day_master_wx
    from .calendar.ganzhi import GAN, GAN_WUXING, HIDDEN, KE, SHENG
    total = 0.0
    for p in chart.pillars:
        for h in HIDDEN[p.zhi]:
            from .calendar.ganzhi import shishen
            if shishen(chart.day_master, h) in gods:
                total += 1.4
        from .calendar.ganzhi import shishen as _ss
        if _ss(chart.day_master, p.gan) in gods and p.position != "day":
            total += 1.8
    base = 34 + total * 6.2
    # 该十神所属五行是否得令
    return max(6.0, min(94.0, base))


def _zhi_health(chart: BaziChart, zhi: str) -> float:
    from .bazi.luck import zhi_relations
    hits = zhi_relations(chart.day.zhi, zhi)
    return 70.0 - 12.0 * sum(1 for h in hits if h in ("六冲", "相刑", "相害"))


@dataclass
class Reading:
    chart: BaziChart
    ziwei: ZiweiChart
    scores: dict = field(default_factory=dict)
    zsummary: dict = field(default_factory=dict)
    cycles: list = field(default_factory=list)
    timeline: list = field(default_factory=list)
    months: list = field(default_factory=list)
    events: dict = field(default_factory=dict)
    meta: dict = field(default_factory=dict)


def build_reading(name: str, gender: str, year: int, month: int, day: int,
                  hour: int = 12, minute: int = 0,
                  longitude: float = 116.40, tz_offset: float = 8.0,
                  use_true_solar: bool = True, zi_boundary: str = "zi_start",
                  sihua_school: str = "sanhe", leap_policy: str = "split",
                  focus_year: int | None = None,
                  events: list | None = None) -> Reading:
    chart = build_chart(name, gender, year, month, day, hour, minute,
                        longitude, 0.0, tz_offset, use_true_solar, zi_boundary)
    zc = build_ziwei(name, gender, year, month, day, hour, minute,
                     longitude, tz_offset, use_true_solar,
                     sihua_school, leap_policy)
    r = Reading(chart=chart, ziwei=zc)
    r.scores = score_overall(chart, zc)
    r.zsummary = zw_analysis.summary(zc)
    r.cycles = bz_luck.luck_cycles(chart, count=10, as_of=focus_year)
    r.timeline = bz_luck.timeline(chart, years=12, as_of_year=focus_year)
    active = next((c for c in r.cycles if c.active), r.cycles[0] if r.cycles else None)
    fy = focus_year or _dt.date.today().year
    r.months = bz_luck.month_periods(chart, fy, active)
    if events:
        r.events = compare_events(chart, events)
    return r


# ---------------------------------------------------------------------------
# Event back-testing & calibration
# ---------------------------------------------------------------------------

EVENT_KINDS = {
    "career": ("事业", "career"),
    "wealth": ("财务", "wealth"),
    "love": ("感情", "love"),
    "health": ("健康", "health"),
    "study": ("学业", "study"),
    "move": ("迁移", "relocation"),
    "family": ("家庭", "family"),
    "loss": ("失去", "loss"),
}


def compare_events(chart: BaziChart, events: list[dict]) -> dict:
    """Score how well the engine's year-scores track the user's real history.

    Each event: {year, kind, impact: -3..+3, note?}
    """
    rows = []
    for ev in events:
        y = int(ev["year"])
        idx = (y - 4) % 60
        from .calendar.ganzhi import GAN, ZHI
        g, z = GAN[idx % 10], ZHI[idx % 12]
        detail = bz_luck.evaluate_period(chart, g, z)
        impact = float(ev.get("impact", 0))
        predicted = detail["score"]
        rows.append({
            "year": y, "ganzhi": g + z,
            "kind": ev.get("kind", "career"),
            "kind_label": EVENT_KINDS.get(ev.get("kind", "career"), ("其他", ""))[0],
            "impact": impact, "note": ev.get("note", ""),
            "predicted": predicted,
            "components": detail["components"],
            "relations": detail["relations"],
            "cautions": detail["cautions"],
            "themes": detail["themes"],
            "agree": (impact > 0.5 and predicted >= 55) or
                     (impact < -0.5 and predicted <= 45) or
                     (-0.5 <= impact <= 0.5 and 45 < predicted < 55),
        })

    n = len(rows)
    hit = sum(1 for r in rows if r["agree"])
    # correlation between predicted score and self-reported impact
    corr = _pearson([r["predicted"] for r in rows], [r["impact"] for r in rows]) if n > 2 else 0.0

    # least-squares calibration of component weights
    ws = _calibrate(rows)
    for r in rows:
        c = r["components"]
        r["calibrated"] = round(max(2, min(98, 50 + sum(
            ws[k] * c.get(k, 0) for k in ("用神", "冲合", "神煞", "大运")))), 1)
    corr2 = _pearson([r["calibrated"] for r in rows], [r["impact"] for r in rows]) if n > 2 else 0.0

    misses = [r for r in rows if not r["agree"]]
    return {
        "rows": rows, "n": n, "hit_rate": round(100.0 * hit / n, 1) if n else 0.0,
        "correlation": round(corr, 3),
        "calibrated_correlation": round(corr2, 3),
        "weights": {k: round(v, 3) for k, v in ws.items()},
        "misses": misses,
        "verdict": _verdict(hit, n, corr),
    }


def _pearson(xs, ys) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return 0.0
    return num / (dx * dy)


def _calibrate(rows) -> dict:
    """Ridge least squares on 4 component weights (no numpy)."""
    keys = ("用神", "冲合", "神煞", "大运")
    if len(rows) < 5:
        return {"用神": 1.0, "冲合": 1.0, "神煞": 1.0, "大运": 1.0}
    X = [[r["components"].get(k, 0.0) for k in keys] + [1.0] for r in rows]
    y = [r["impact"] * 12.0 for r in rows]
    m = 5
    A = [[sum(X[i][a] * X[i][b] for i in range(len(X))) + (0.6 if a == b else 0.0)
          for b in range(m)] for a in range(m)]
    b = [sum(X[i][a] * y[i] for i in range(len(X))) for a in range(m)]
    # gaussian elimination
    for i in range(m):
        p = max(range(i, m), key=lambda r: abs(A[r][i]))
        A[i], A[p] = A[p], A[i]
        b[i], b[p] = b[p], b[i]
        if abs(A[i][i]) < 1e-9:
            continue
        inv = 1.0 / A[i][i]
        A[i] = [v * inv for v in A[i]]
        b[i] *= inv
        for k in range(m):
            if k == i:
                continue
            f = A[k][i]
            if f:
                A[k] = [A[k][j] - f * A[i][j] for j in range(m)]
                b[k] -= f * b[i]
    sol = b[:4]
    # keep sane magnitudes
    sol = [max(0.2, min(2.2, v)) for v in sol]
    return dict(zip(keys, sol))


def _verdict(hit: int, n: int, corr: float) -> str:
    if n == 0:
        return "未提供经历，无法校准。"
    rate = hit / n
    if rate >= 0.75 and corr >= 0.5:
        return "模型与你的经历高度吻合，后续流年评分的参考价值较高。"
    if rate >= 0.6:
        return "模型大体吻合，局部年份偏乐观或偏保守，建议以校准后的分数为主。"
    if rate >= 0.4:
        return "吻合度一般——这说明你的命局中权重配置与通用模型有差异，校准权重已调整。"
    return "吻合度偏低。请检查：①出生时间是否为真太阳时或夏令时；②经历年份是否按立春计；③是否存在重大外部变量（时代、家庭）压过个人命局。"
