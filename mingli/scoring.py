"""Overall structure scoring, v2.

Three methodological errors in v1 are fixed here:

1. v1 scored "structure" as distance from a neutral day-master strength, which
   penalises every chart that is *supposed* to be lopsided (专旺, 从格, 月刃).
   格局法 judges whether a structure is **established**, not whether the chart
   is average.
2. v1 gave 40/100 whenever the climate god was absent. Missing climate stems are
   the normal case, and a same-element substitute (癸 for 壬, 辛 for 庚) does
   part of the job. Absence is now 46 and substitution counts 0.55.
3. v1 ignored shensha and the year/month pillars entirely, even though 祖荫、
   出身 live exactly there. Both are now scored.

The result is still normalised so that a random chart lands near 55 and the
percentile table (see data_percentiles.py) is what labels the tier.
"""

from __future__ import annotations

import math

from .bazi import luck as bz_luck
from .calendar.ganzhi import (CHONG, GAN, GAN_HE, GAN_WUXING, KE, SHENG, ZHI,
                               ZHI_WUXING)
from .ziwei import analysis as zw_analysis

DIMS = ["structure", "flow", "climate", "root", "ming", "sanfang", "shensha",
        "relations"]
#: 合冲刑害单列一维，权重从其余各项按比例让出。它测的东西别处测不到：
#: 一个五行很匀的盘，也可能被三刑两冲撕得七零八落。
WEIGHTS = {"structure": 0.20, "flow": 0.09, "climate": 0.09, "root": 0.13,
           "ming": 0.20, "sanfang": 0.10, "shensha": 0.09, "relations": 0.10}

DIM_ZH = {"structure": "格局层次", "flow": "五行流通", "climate": "调候得宜",
          "root": "年月根基", "ming": "紫微命宫", "sanfang": "三方四正",
          "shensha": "神煞吉凶", "relations": "合冲刑害"}
DIM_WEAK_ZH = {
    "structure": "格局层次偏弱：取格不显或破格，弱于 {p}% 的命盘",
    "flow": "五行偏枯，流通有断点，弱于 {p}% 的命盘",
    "climate": "调候不足，先天气候支持有限，弱于 {p}% 的命盘",
    "root": "年月根基一般，祖荫与早年环境帮助有限，弱于 {p}% 的命盘",
    "ming": "紫微命宫力量偏弱，弱于 {p}% 的命盘",
    "sanfang": "三方四正会照平淡，弱于 {p}% 的命盘",
    "shensha": "神煞偏凶，弱于 {p}% 的命盘",
    "relations": "合冲刑害偏杂：局中刑冲重叠或合多受绊，弱于 {p}% 的命盘",
}
DIM_EN = {"structure": "Structure", "flow": "Element flow", "climate": "Climate",
          "root": "Foundations", "ming": "Life palace", "sanfang": "Trine",
          "shensha": "Stars", "relations": "Interactions"}


def _entropy(weights: dict) -> float:
    vals = [v for v in weights.values() if v > 0]
    total = sum(vals) or 1
    h = -sum((v / total) * math.log(v / total) for v in vals)
    return h / math.log(5)


def _useful(chart):
    # 整体评分沿用扶抑口径（分位数表按它标定），与流年所用的格局用神体系分开；
    # 两者混用会让所有人的总分一起漂移。
    return bz_luck.strength_useful(chart)


def structure_score(chart) -> tuple[float, list[str], list[str]]:
    """格局层次：取格是否成立、用神是否到位、有无破格。"""
    s = 50.0
    plus, minus = [], []
    st = chart.structure

    if st["kind"] == "特殊格":
        s += 12
        plus.append(f"成{st['name']}，特殊格局立得住")
    elif st["transparent"]:
        s += 10
        plus.append(f"{st['name']}取格清晰（月令藏干透出）")
    else:
        s += 4
        plus.append(f"{st['name']}以月令本气论，格象平实")

    th = chart.tiaohou
    gans = set(chart.all_gan())
    hidden = set(chart.hidden_all())
    primary = th.get("primary", "")
    if primary and primary in gans:
        s += 10
        plus.append(f"调候用神{primary}透干")
    elif primary and primary in hidden:
        s += 5
        plus.append(f"调候用神{primary}藏支，力弱可用")
    elif primary:
        subst = _substitute(primary)
        if subst and (subst in gans or subst in hidden):
            s += 2
            plus.append(f"调候{primary}不见，得{subst}同类代之，力减而意存")
        else:
            s -= 6
            minus.append(f"调候{primary}全无，气候失和")

    favor, _avoid, _why = _useful(chart)
    dm = chart.day_master_wx
    yin = [k for k in SHENG if SHENG[k] == dm][0]
    cai = KE[dm]
    guan = [k in KE and k or "" for k in KE if KE[k] == dm][0]
    strong = chart.strength >= 52
    if strong and (cai in favor or guan in favor):
        s += 6
        plus.append("身强而用财官，担得起")
    elif not strong and yin in favor:
        s += 6
        plus.append("身弱而用印比，扶得起")
    elif strong and yin in favor:
        s -= 4
        minus.append("身已过旺而仍取印比，方向有偏")
    elif not strong and (cai in favor or guan in favor):
        s -= 4
        minus.append("身弱而取财官，力所不及")

    # 贵气：天乙、天月二德为传统「贵」的标志，不能只当装饰
    noble = 0
    for nm, v in (("天乙贵人", 4), ("天德贵人", 3), ("月德贵人", 3)):
        if nm in chart.shensha:
            noble += v
    if noble:
        s += min(8, noble)
        plus.append("命带天乙/天月二德，贵气有根")

    # 破格
    mz = chart.month.zhi
    if any(CHONG[mz] == z for i, z in enumerate(chart.all_zhi()) if i != 1):
        s -= 6
        minus.append("月令被冲，格局根气受损")
    dg = chart.day.gan
    if any(GAN_HE.get(dg, ("",))[0] == g for i, g in enumerate(chart.all_gan()) if i != 2):
        s -= 5
        minus.append("日主被合，意志易受牵制")
    if "刃" in chart.structure["name"]:
        has_guan = any(x in ("正官", "七杀") for x in
                       (chart.year.shishen_gan, chart.month.shishen_gan,
                        chart.hour.shishen_gan))
        if not has_guan:
            s -= 6
            minus.append("月刃无官杀制，刚而易折")

    return max(20.0, min(95.0, s)), plus, minus


_SUBSTITUTE = {"壬": "癸", "癸": "壬", "庚": "辛", "辛": "庚",
               "甲": "乙", "乙": "甲", "丙": "丁", "丁": "丙",
               "戊": "己", "己": "戊"}


def _substitute(stem: str) -> str:
    return _SUBSTITUTE.get(stem, "")


def flow_score(chart, favor=None) -> tuple[float, list[str]]:
    """五行流通：分布均匀度 + 是否存在相生链。

    `favor` 给出喜用时，「某一行近乎断绝」只在**它是喜用**时才算断点。
    旧版不分喜忌：身旺盘印（木）断尽本是好事，却照样扣 5 分，于是
    「偏枯但清」的格局在流通这一维被当成「气不通」。
    """
    es = chart.element_scores
    ent = _entropy(es)
    score = ent * 70 + 20
    notes = []
    order = ["木", "火", "土", "金", "水"]
    chains = 0
    for i in range(5):
        a, b, c = order[i], order[(i + 1) % 5], order[(i + 2) % 5]
        if es[a] >= 3 and es[b] >= 3 and es[c] >= 3:
            chains += 1
    if chains:
        score += min(10.0, chains * 2.5)
        notes.append(f"五行有 {chains} 条连续相生链，气能流转")
    weakest = min(es, key=es.get)
    if es[weakest] < 2:
        if not favor or weakest in favor:
            score -= 5
            notes.append(f"{weakest}近乎断绝（{es[weakest]:.1f}%），流通有断点")
        else:
            notes.append(f"{weakest}几近断绝（{es[weakest]:.1f}%），但它是忌神，"
                         f"断之反成清局，不作断点论")
    return max(15.0, min(95.0, score)), notes


def climate_score(chart) -> tuple[float, list[str]]:
    """调候：按命中程度给分，允许同类替代。"""
    th = chart.tiaohou
    seq = th.get("sequence") or ""
    if not seq:
        return 60.0, []
    gans = set(chart.all_gan())
    hidden = set(chart.hidden_all())
    got, total, notes = 0.0, len(seq), []
    for ch in seq:
        if ch in gans:
            got += 1.0
        elif ch in hidden:
            got += 0.75
        else:
            sub = _substitute(ch)
            if sub and (sub in gans or sub in hidden):
                got += 0.55
                notes.append(f"{ch}不见，以{sub}代之")
    ratio = got / total
    score = 46 + 40 * ratio
    if ratio >= 0.95:
        notes.append("调候齐备，先天气候得宜")
    elif ratio <= 0.1:
        notes.append("调候全缺，环境给的支持有限，需后天补")
    return max(30.0, min(94.0, score)), notes


def root_score(chart) -> tuple[float, list[str]]:
    """年月根基：祖荫、出身、早年环境。"""
    s = 55.0
    notes = []
    y, m = chart.year, chart.month
    if y.shishen_gan in ("正官", "正印", "正财"):
        s += 6
        notes.append(f"年干{y.gan}为{y.shishen_gan}，祖上有位有守")
    if y.shishen_gan in ("七杀", "伤官", "劫财"):
        s -= 3
        notes.append(f"年干{y.gan}为{y.shishen_gan}，早年少庇荫")
    for name in ("天乙贵人", "天德贵人", "月德贵人", "太极贵人"):
        v = chart.shensha.get(name)
        if v and "年" in v["positions"]:
            s += 4
            notes.append(f"年支带{name}")
            break
    if any(CHONG[y.zhi] == z for i, z in enumerate(chart.all_zhi()) if i != 0):
        s -= 5
        notes.append("年支被冲，根基有动")
    if m.shishen_gan in ("正官", "正印", "正财", "食神"):
        s += 3
        notes.append(f"月干{m.gan}为{m.shishen_gan}，早年环境端正")
    if "刃" in chart.structure["name"]:
        s -= 2
        notes.append("月令带刃，少年性烈")
    return max(25.0, min(92.0, s)), notes


#: 刑冲害破的基准强度。层级来自各家共许的「三刑重于冲，冲重于害，害重于破」。
#: 系数按「这一维要有区分度」标定过：原来的 ±4 让全盘标准差只有 3.7，
#: 十张盘挤在 48–56 之间，等于没有这个维度。放大之后 sd ≈ 7。
_SEVERITY = {"六冲": 6.5, "三刑": 6.0, "相刑": 3.6, "自刑": 3.0,
             "六害": 2.2, "六破": 1.8}
#: 柱位权重：月令与日支是全局最重的两个位置
_POSW = {0: 0.70, 1: 1.20, 2: 1.20, 3: 0.70}


def relations_score(chart) -> tuple[float, list[str], list[str]]:
    """合冲刑害：整盘是不是「内部撕扯」。

    古法没有分值，但有明确的吉凶方向，这里只把它算出来：

    - **冲刑害破伤的是谁**才决定吉凶。冲去忌神是去病（主吉），冲伤用神是
      拆台（主凶），冲闲神只是动。旧版凡冲皆罚，于是「冲开忌神」的好年份
      被判成凶年。
    - **合化之后是什么五行**才决定吉凶。合化为喜用是得助，合化为忌是牵累。
      合多而不化反而是「绊」——人被关系拴住，动弹不得。
    - **刑冲的数量**本身是动荡的指标，与喜忌无关。

    返回 (分数, 加分说明, 减分说明)。
    """
    model = getattr(chart, "relations_model", None)
    if model is None:
        return 55.0, [], []

    from .bazi.relations import POSN as _P

    favor, avoid, _meta = bz_luck.strength_useful(chart)
    nodes = dict(model.nodes)

    def side(idx: int) -> int:
        """这一支（合化之后）对日主是喜 +1、忌 -1、闲 0。"""
        merged = model.merged.get(idx)
        el = merged[0] if merged else ZHI_WUXING[ZHI.index(nodes[idx])]
        return 1 if el in favor else (-1 if el in avoid else 0)

    s = 58.0
    plus, minus = [], []

    for rel in model.items:
        w = sum(_POSW.get(i, 0.7) for i in rel.pos) / max(1, len(rel.pos))

        if rel.kind in _SEVERITY:
            sev = _SEVERITY[rel.kind]
            sides = [side(i) for i in rel.pos]
            mean_side = sum(sides) / len(sides)
            if rel.kind in ("六冲",):
                # 冲：去病为吉，伤用为凶，闲神则动
                s += mean_side * sev * w
            else:
                # 刑害破：本身带伤，刑去忌神也只是「伤得轻」
                s -= sev * w * (0.55 + 0.45 * max(0.0, mean_side))
            name = rel.label
            (plus if mean_side > 0 else minus).append(
                f"{name}（{'+' if mean_side > 0 else '-'}）")

        elif rel.kind in ("三会", "三合", "半合", "六合") and rel.transforms:
            el = rel.element
            gain = 9.0 * rel.strength * w
            if el in favor:
                s += gain
                plus.append(f"{rel.label}，化为喜用")
            elif el in avoid:
                s -= gain
                minus.append(f"{rel.label}，化为忌神")
            else:
                plus.append(f"{rel.label}，化神为闲")

    tal = _tally(model)
    if tal["combine_n"] >= 3:
        s -= 4.5
        minus.append("合多则绊：局中合局过多，反受牵制")
    if tal["clash_n"] >= 3:
        s -= 5.0
        minus.append("刑冲重叠：一生多动荡，难以累积")

    # 日支（配偶宫）被冲，另计
    day_hits = [r for r in model.items
                if 2 in r.pos and r.kind in ("六冲", "三刑")]
    if day_hits:
        s -= 3.2
        minus.append("日支受冲刑，配偶宫不稳")

    return max(20.0, min(92.0, s)), plus, minus


def _tally(model) -> dict:
    from .bazi.relations import tally
    return tally(model)


def shensha_score(chart) -> tuple[float, int, int, int]:
    good = sum(1 for v in chart.shensha.values() if v["nature"] == "吉")
    mid = sum(1 for v in chart.shensha.values() if v["nature"] == "中")
    bad = sum(1 for v in chart.shensha.values() if v["nature"] == "凶")
    s = 50 + 2.4 * good - 2.8 * bad + 0.8 * mid
    return max(20.0, min(94.0, s)), good, mid, bad


def score_overall(chart, zc) -> dict:
    es = chart.element_scores
    struct, s_plus, s_minus = structure_score(chart)
    flow, f_notes = flow_score(chart, _useful(chart)[0])
    climate, c_notes = climate_score(chart)
    root, r_notes = root_score(chart)
    sh, n_good, n_mid, n_bad = shensha_score(chart)
    rels, rel_plus, rel_minus = relations_score(chart)

    zsum = zw_analysis.summary(zc)
    ming = zsum["ming_score"]
    cai_s = zsum["wealth_score"]
    guan = zsum["career_score"]
    qian = zw_analysis.palace_score(zc, zc.palace("迁移"))[0]
    sanfang = round(ming * 0.4 + cai_s * 0.2 + guan * 0.2 + qian * 0.2, 1)

    dims = {"structure": round(struct, 1), "flow": round(flow, 1),
            "climate": round(climate, 1), "root": round(root, 1),
            "ming": round(ming, 1), "sanfang": sanfang,
            "shensha": round(sh, 1), "relations": round(rels, 1)}
    overall = sum(dims[k] * WEIGHTS[k] for k in DIMS)

    # 六领域
    dm = chart.day_master_wx
    yin = [k for k in SHENG if SHENG[k] == dm][0]
    shi, cai, guan_wx = SHENG[dm], KE[dm], [k for k in KE if KE[k] == dm][0]

    def share(el):
        return es.get(el, 0.0)

    def share_score(p):
        return max(6.0, min(92.0, 55.0 + (p - 20.0) * 1.2))

    male = chart.gender in ("male", "男", "m")
    love_el = cai if male else guan_wx
    career = 0.45 * (share_score(share(guan_wx)) + share_score(share(shi))) / 2 + 0.55 * guan
    wealth = 0.45 * share_score(share(cai)) + 0.55 * cai_s
    love = 0.35 * share_score(share(love_el)) + 0.35 * sanfang \
        + 0.30 * _zhi_health(chart, chart.day.zhi)
    health = 0.4 * max(10.0, 95 - abs(share(dm) - 22) * 2.6) \
        + 0.6 * zw_analysis.palace_score(zc, zc.palace("疾厄"))[0]
    study = 0.45 * share_score(share(yin)) + 0.55 * ming
    social = 0.35 * share_score(share(dm)) \
        + 0.65 * zw_analysis.palace_score(zc, zc.palace("仆役"))[0]

    CL = 94.0
    areas = {
        "career": round(min(CL, max(6, career)), 1),
        "wealth": round(min(CL, max(6, wealth)), 1),
        "love": round(min(CL, max(6, love)), 1),
        "health": round(min(CL, max(6, health)), 1),
        "study": round(min(CL, max(6, study)), 1),
        "social": round(min(CL, max(6, social)), 1),
    }
    # 低于人群的维度自动进入「短板」，不只靠破格判断
    pct_of = {k: (0.5 + 0.5 * math.erf(((dims[k] - DIM_STATS.get(k, [60, 8])[0])
                 / (DIM_STATS.get(k, [60, 8])[1] or 1)) / math.sqrt(2))) * 100
              for k in DIMS}
    for k, pv in sorted(pct_of.items(), key=lambda kv: kv[1]):
        if pv >= 35:
            break
        s_minus.append(DIM_WEAK_ZH[k].format(p=round(100 - pv)))
        break

    hl, wk = [], []
    for n in s_plus + f_notes + c_notes + r_notes + rel_plus[:2]:
        (wk if ("断点" in n or "断绝" in n or "偏枯" in n) else hl).append(n)

    s_minus.extend(rel_minus[:2])
    overall = max(2.0, min(98.0, overall))
    pct = percentile_of(overall)
    return {
        "overall": round(overall, 1), "percentile": pct,
        "zscores": {k: round((dims[k] - DIM_STATS.get(k, [60, 8])[0]) /
                             (DIM_STATS.get(k, [60, 8])[1] or 1), 2) for k in DIMS},
        "tier": tier_of(pct), "dimensions": dims, "areas": areas,
        "weights": WEIGHTS,
        "highlights": hl,
        "weaknesses": wk + s_minus,
        "shensha_count": {"good": n_good, "mid": n_mid, "bad": n_bad},
    }


def _zhi_health(chart, zhi: str) -> float:
    from .bazi.luck import zhi_relations
    hits = zhi_relations(chart.day.zhi, zhi)
    return 70.0 - 12.0 * sum(1 for h in hits if h in ("六冲", "相刑", "相害"))


# ---------------------------------------------------------------------------
# Percentile calibration (table generated by tools/make_percentiles.py)
# ---------------------------------------------------------------------------

try:                                   # pragma: no cover
    from .data_percentiles import QUANTILES, DIM_STATS, YEAR_QUANTILES  # noqa: F401
except Exception:                      # pragma: no cover
    QUANTILES = [0.0] * 101
    YEAR_QUANTILES = [0.0] * 101
    DIM_STATS = {k: [60.0, 8.0] for k in DIMS}


def _lookup(q: list, score: float) -> float:
    if not q or q[-1] <= 0:
        return 50.0
    if score <= q[0]:
        return 0.0
    if score >= q[-1]:
        return 100.0
    for i in range(100):
        if q[i] <= score <= q[i + 1]:
            span = (q[i + 1] - q[i]) or 1e-9
            return round(i + (score - q[i]) / span, 1)
    return 50.0


def percentile_of(score: float) -> float:
    """Where a raw score sits in the distribution of random charts (0-100)."""
    return _lookup(QUANTILES, score)


def year_percentile_of(score: float) -> float:
    """Where an annual score sits in the distribution of random annual scores.

    The annual scale is clamped to 32-94, so a raw annual score means nothing on
    its own; this is what turns it into a position.
    """
    return _lookup(YEAR_QUANTILES, score)


def tier_of(pct: float) -> str:
    if pct >= 97:
        return "上上格"
    if pct >= 88:
        return "上格"
    if pct >= 72:
        return "中上格"
    if pct >= 40:
        return "中格"
    if pct >= 15:
        return "中下格"
    return "下格"
