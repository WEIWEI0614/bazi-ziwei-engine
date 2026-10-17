"""Assemble a complete reading: chart + ziwei + scores + timelines + events."""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from .bazi import luck as bz_luck
from .bazi.chart import BaziChart, build_chart
from .calendar import astro
from .ziwei import analysis as zw_analysis
from .ziwei.chart import ZiweiChart, build_ziwei

from . import pattern as _pattern
from .scoring import score_overall  # noqa: E402


@dataclass
class Reading:
    chart: BaziChart
    ziwei: ZiweiChart
    scores: dict = field(default_factory=dict)
    grade: dict = field(default_factory=dict)
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
    # 格位（贵贱）与强度（力量）分开：前者按「成格/破格/救应」判定，
    # 后者是七维加权。二者不可互相折算，故并列出。
    r.grade = _pattern.combined_grade(_pattern.bazi_grade(chart),
                                      _pattern.ziwei_grade(zc))
    r.scores["grade"] = r.grade
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
        "verdict_en": _verdict_en(hit, n, corr),
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


def _verdict_en(hit: int, n: int, corr: float) -> str:
    if n == 0:
        return "No events supplied — nothing to calibrate against."
    rate = hit / n
    if rate >= 0.75 and corr >= 0.5:
        return "The model tracks your reported years closely; its forward scores are worth weighing."
    if rate >= 0.6:
        return "Broad agreement, with some years read too optimistically or too harshly. Prefer the calibrated scores."
    if rate >= 0.4:
        return "Moderate agreement — your chart's weights differ from the generic model. The weights have been refitted."
    return ("Poor agreement. Check (1) whether the birth time was already true solar time or daylight saving, "
            "(2) whether events are counted from Li Chun, (3) whether era or family factors outweighed the chart.")


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
