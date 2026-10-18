"""Four Pillars (八字) chart construction."""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from ..calendar import astro, lunar
from ..calendar.ganzhi import (
    CHANGSHENG, GAN, GAN_CHONG, GAN_HE, GAN_WUXING, HAI6, HE6, HIDDEN,
    HUAGAI, JIANGXING, KE, LU, NAYIN, PO, SANHE, SANHUI, SHENG, TIANYI,
    TAOHUA, WENCHANG, WUXING_EN, YANGREN, YIMA, ZHI, ZHI_WUXING, CHONG,
    changsheng, ganzhi_index, nayin, shishen, xunkong,
)

# ---------------------------------------------------------------------------
# Weights used by the quantitative strength model.
#   stems  : 0.08 / 0.12 / 0.12 / 0.12
#   branches: 0.10 / 0.24 / 0.12 / 0.10   (月令 gets 24 %)
# ---------------------------------------------------------------------------
STEM_W = {"year": 0.08, "month": 0.12, "day": 0.12, "hour": 0.12}
BRANCH_W = {"year": 0.10, "month": 0.24, "day": 0.12, "hour": 0.10}

SEASON_STATE = {
    # month branch -> state of each element: 旺 相 休 囚 死
    "寅": {"木": "旺", "火": "相", "水": "休", "金": "囚", "土": "死"},
    "卯": {"木": "旺", "火": "相", "水": "休", "金": "囚", "土": "死"},
    "辰": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
    "巳": {"火": "旺", "土": "相", "木": "休", "水": "囚", "金": "死"},
    "午": {"火": "旺", "土": "相", "木": "休", "水": "囚", "金": "死"},
    "未": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
    "申": {"金": "旺", "水": "相", "土": "休", "火": "囚", "木": "死"},
    "酉": {"金": "旺", "水": "相", "土": "休", "火": "囚", "木": "死"},
    "戌": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
    "亥": {"水": "旺", "木": "相", "金": "休", "土": "囚", "火": "死"},
    "子": {"水": "旺", "木": "相", "金": "休", "土": "囚", "火": "死"},
    "丑": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
}
STATE_MULT = {"旺": 1.45, "相": 1.20, "休": 0.85, "囚": 0.70, "死": 0.55}

# 調候用神 (窮通寶鑑, 徐樂吾注本通行表).  key: day stem -> month branch
TIAOHOU = {
    "甲": {"寅": "丙癸", "卯": "庚丙戊己", "辰": "庚丁壬", "巳": "癸丁庚",
           "午": "癸丁庚", "未": "癸丁庚", "申": "庚丁壬", "酉": "庚丙丁",
           "戌": "庚甲丁壬癸", "亥": "庚丁丙戊", "子": "丁庚丙戊", "丑": "丁庚丙"},
    "乙": {"寅": "丙癸", "卯": "丙癸", "辰": "癸丙戊", "巳": "癸",
           "午": "癸丙", "未": "癸丙", "申": "丙癸己", "酉": "癸丙丁",
           "戌": "癸辛", "亥": "丙戊", "子": "丙", "丑": "丙"},
    "丙": {"寅": "壬庚", "卯": "壬己", "辰": "壬甲", "巳": "壬癸庚",
           "午": "壬庚", "未": "壬庚", "申": "壬戊", "酉": "壬癸",
           "戌": "甲壬", "亥": "甲戊庚壬", "子": "壬戊己", "丑": "壬甲"},
    "丁": {"寅": "甲庚", "卯": "庚甲", "辰": "甲庚", "巳": "甲庚",
           "午": "壬庚癸", "未": "甲壬庚", "申": "甲庚丙戊", "酉": "甲庚丙戊",
           "戌": "甲庚戊", "亥": "甲庚", "子": "甲庚", "丑": "甲庚"},
    "戊": {"寅": "丙甲癸", "卯": "丙甲癸", "辰": "甲丙癸", "巳": "甲丙癸",
           "午": "壬甲丙", "未": "癸丙甲", "申": "丙癸甲", "酉": "丙癸",
           "戌": "甲丙癸", "亥": "甲丙", "子": "丙甲", "丑": "丙甲"},
    "己": {"寅": "丙庚甲", "卯": "甲癸丙", "辰": "丙癸甲", "巳": "癸丙",
           "午": "癸丙", "未": "癸丙", "申": "丙癸", "酉": "丙癸",
           "戌": "甲丙癸", "亥": "丙甲戊", "子": "丙甲戊", "丑": "丙甲戊"},
    "庚": {"寅": "戊甲壬丙丁", "卯": "丁甲庚丙", "辰": "甲丁壬癸", "巳": "壬戊丙丁",
           "午": "壬癸", "未": "丁甲", "申": "丁甲", "酉": "丁甲丙",
           "戌": "甲壬", "亥": "丁丙", "子": "丁甲丙", "丑": "丙丁甲"},
    "辛": {"寅": "己壬庚", "卯": "壬甲", "辰": "壬甲", "巳": "壬甲癸",
           "午": "壬己癸", "未": "壬庚甲", "申": "壬甲戊", "酉": "壬甲",
           "戌": "壬甲", "亥": "丙壬戊", "子": "丙戊壬甲", "丑": "丙壬戊己"},
    "壬": {"寅": "庚丙戊", "卯": "戊辛庚", "辰": "甲庚", "巳": "壬辛庚癸",
           "午": "癸庚辛", "未": "辛甲", "申": "戊丁", "酉": "甲庚",
           "戌": "甲丙", "亥": "戊丙庚", "子": "戊丙", "丑": "丙丁甲"},
    "癸": {"寅": "辛丙", "卯": "庚辛", "辰": "丙辛甲", "巳": "辛",
           "午": "庚辛壬癸", "未": "庚辛壬癸", "申": "丁", "酉": "辛丙",
           "戌": "辛甲壬癸", "亥": "庚辛戊丁", "子": "丙辛", "丑": "丙丁"},
}

XING = [("寅", "巳", "申"), ("丑", "戌", "未"), ("子", "卯"), ("辰",), ("午",), ("酉",), ("亥",)]


@dataclass
class Pillar:
    position: str          # year / month / day / hour
    gan: str
    zhi: str
    shishen_gan: str = ""
    shishen_zhi: str = ""
    hidden: tuple = ()
    nayin: str = ""
    nayin_en: str = ""
    stage: str = ""
    stage_en: str = ""
    kong: tuple = ()
    self_xing: bool = False

    @property
    def gan_wx(self) -> str:
        return GAN_WUXING[GAN.index(self.gan)]

    @property
    def zhi_wx(self) -> str:
        return ZHI_WUXING[ZHI.index(self.zhi)]


@dataclass
class BaziChart:
    # input
    name: str
    gender: str
    birth_local: _dt.datetime
    longitude: float
    latitude: float
    tz_offset: float
    use_true_solar: bool
    zi_boundary: str
    # derived
    true_solar: _dt.datetime = field(default=None)
    jd: float = 0.0
    lunar_date: object = None
    pillars: list = field(default_factory=list)
    day_master: str = ""
    day_master_wx: str = ""
    element_scores: dict = field(default_factory=dict)
    seasonal_state: dict = field(default_factory=dict)
    strength: float = 0.0
    strength_label: str = ""
    structure: dict = field(default_factory=dict)
    tiaohou: dict = field(default_factory=dict)
    shensha: dict = field(default_factory=dict)
    relations: dict = field(default_factory=dict)
    notes: list = field(default_factory=list)
    jie_prev: tuple = ()
    jie_next: tuple = ()

    @property
    def year(self) -> Pillar:
        return self.pillars[0]

    @property
    def month(self) -> Pillar:
        return self.pillars[1]

    @property
    def day(self) -> Pillar:
        return self.pillars[2]

    @property
    def hour(self) -> Pillar:
        return self.pillars[3]

    def four(self) -> str:
        return " ".join(p.gan + p.zhi for p in self.pillars)

    def all_gan(self):
        return [p.gan for p in self.pillars]

    def all_zhi(self):
        return [p.zhi for p in self.pillars]

    def hidden_all(self):
        out = []
        for p in self.pillars:
            out.extend(HIDDEN[p.zhi])
        return out


def true_solar_offset(jd_local: float, longitude: float, tz_offset: float) -> float:
    """Minutes to add to civil time to obtain local apparent solar time."""
    lon_corr = (longitude - tz_offset * 15.0) * 4.0
    eot = astro.equation_of_time_minutes(jd_local)
    return lon_corr + eot


def build_chart(name: str, gender: str, year: int, month: int, day: int,
                hour: int = 12, minute: int = 0,
                longitude: float = 116.40, latitude: float = 39.90,
                tz_offset: float = 8.0, use_true_solar: bool = True,
                zi_boundary: str = "zi_start") -> BaziChart:
    birth = _dt.datetime(year, month, day, hour, minute)
    jd = astro.to_jd(year, month, day, hour, minute)
    ts = birth
    if use_true_solar:
        off = true_solar_offset(jd, longitude, tz_offset)
        ts = birth + _dt.timedelta(minutes=off)
        jd_true = astro.to_jd(ts.year, ts.month, ts.day, ts.hour, ts.minute,
                              ts.second)
    else:
        jd_true = jd

    ly = lunar.year_pillar(jd)
    mg, mz, jie = lunar.month_pillar(jd, ly[0])
    dg, dz = lunar.day_pillar(jd_true, zi_boundary)
    hb = lunar.hour_branch_of(ts.hour + ts.minute / 60.0)
    hg = lunar.hour_pillar(dg, hb)

    chart = BaziChart(
        name=name, gender=gender, birth_local=birth, longitude=longitude,
        latitude=latitude, tz_offset=tz_offset, use_true_solar=use_true_solar,
        zi_boundary=zi_boundary, true_solar=ts, jd=jd_true,
        lunar_date=lunar.lunar_from_jd(jd),
    )

    raw = [("year", ly[0], ly[1]), ("month", mg, mz),
           ("day", dg, dz), ("hour", hg, hb)]
    dm = dg
    chart.day_master = dm
    chart.day_master_wx = GAN_WUXING[GAN.index(dm)]

    for pos, g, z in raw:
        ny, nyen = nayin(g, z)
        p = Pillar(
            position=pos, gan=g, zhi=z,
            shishen_gan="日主" if pos == "day" else shishen(dm, g),
            shishen_zhi=shishen(dm, HIDDEN[z][0]),
            hidden=HIDDEN[z],
            nayin=ny, nayin_en=nyen,
            stage=changsheng(g, z),
            stage_en=CHANGSHENG.__getitem__(CHANGSHENG.index(changsheng(g, z))),
            kong=xunkong(g, z),
        )
        chart.pillars.append(p)

    # 節氣 neighbours (for 大運 and for the monthly timeline)
    gy = year
    prev_j, next_j = _surrounding_jie(jd, gy)
    chart.jie_prev = prev_j
    chart.jie_next = next_j

    _score_elements(chart)
    _analyse_structure(chart)
    _analyse_tiaohou(chart)
    _find_shensha(chart)
    _find_relations(chart)
    return chart


def _surrounding_jie(jd: float, gy: int):
    marks = []
    for yy in (gy - 2, gy - 1, gy, gy + 1, gy + 2):
        for name in astro.JIE_NAMES:
            marks.append((astro.term_local(yy, name), name, yy))
    marks.sort()
    prev, nxt = marks[0], marks[-1]
    for i, m in enumerate(marks):
        if m[0] <= jd:
            prev = m
            if i + 1 < len(marks):
                nxt = marks[i + 1]
        else:
            break
    return prev, nxt


# ---------------------------------------------------------------------------
# Quantitative strength model
# ---------------------------------------------------------------------------


def _score_elements(chart: BaziChart) -> None:
    scores = {w: 0.0 for w in ("木", "火", "土", "金", "水")}
    for p in chart.pillars:
        scores[p.gan_wx] += STEM_W[p.position]
        weights = {1: (1.0,), 2: (0.7, 0.3), 3: (0.6, 0.28, 0.12)}[len(HIDDEN[p.zhi])]
        for h, w in zip(HIDDEN[p.zhi], weights):
            scores[GAN_WUXING[GAN.index(h)]] += BRANCH_W[p.position] * w

    state = SEASON_STATE[chart.month.zhi]
    chart.seasonal_state = state
    for el, st in state.items():
        scores[el] *= STATE_MULT[st]

    # 三合 / 三會 / 半合 加成
    zhis = chart.all_zhi()
    for group in SANHE:
        hits = [z for z in group[:3] if z in zhis]
        if len(hits) == 3:
            scores[group[3]] += 0.18
        elif len(hits) == 2:
            scores[group[3]] += 0.06
    for group in SANHUI:
        if all(z in zhis for z in group[:3]):
            scores[group[3]] += 0.20

    total = sum(scores.values()) or 1.0
    chart.element_scores = {k: round(v / total * 100, 2) for k, v in scores.items()}

    dm_wx = chart.day_master_wx
    yin = [k for k in SHENG if SHENG[k] == dm_wx][0]
    ally_pct = chart.element_scores[dm_wx] + chart.element_scores[yin]
    chart.strength = round(ally_pct, 2)
    if ally_pct >= 62:
        chart.strength_label = "极强"
    elif ally_pct >= 52:
        chart.strength_label = "偏强"
    elif ally_pct >= 45:
        chart.strength_label = "中和"
    elif ally_pct >= 37:
        chart.strength_label = "偏弱"
    else:
        chart.strength_label = "极弱"


# ---------------------------------------------------------------------------
# Structure (格局)
# ---------------------------------------------------------------------------


def _analyse_structure(chart: BaziChart) -> None:
    dm = chart.day_master
    mz = chart.month.zhi
    m_hidden = HIDDEN[mz]
    transparent = [p.gan for p in chart.pillars if p.position != "day"]
    transparent_else = transparent + [chart.hour.gan]

    candidates = []
    for i, h in enumerate(m_hidden):
        if h in transparent_else:
            candidates.append((h, ["本气", "中气", "余气"][i]))

    dm_wx = chart.day_master_wx
    m_wx = ZHI_WUXING[ZHI.index(mz)]

    name, basis, kind = "", "", ""
    if candidates:
        h, layer = candidates[0]
        ss = shishen(dm, h)
        if ss in ("比肩", "劫财"):
            if mz == LU[dm]:
                name, basis = "建禄格", f"月令{mz}为日主临官（禄）之地，{h}透干，取建禄格"
            elif mz == YANGREN[dm]:
                name, basis = "月刃格", f"月令{mz}为日主帝旺（羊刃）之地，{h}透干，取月刃格"
            else:
                name, basis = f"{ss}格", f"月令{mz}藏{h}透干，{ss}当权，不属禄刃"
        else:
            name = {
                "正官": "正官格", "七杀": "七杀格", "正财": "正财格", "偏财": "偏财格",
                "食神": "食神格", "伤官": "伤官格", "正印": "正印格", "偏印": "偏印格",
            }.get(ss, "杂气格")
            basis = f"月令{mz}藏{h}（{layer}）透于天干，以{ss}取格"
        kind = "普通格"
    elif m_wx == dm_wx:
        if mz == LU[dm]:
            name, basis = "建禄格", f"月令{mz}为日主临官（禄）之地，取建禄格"
        elif mz == YANGREN[dm]:
            name, basis = "月刃格", f"月令{mz}为日主帝旺（羊刃）之地，取月刃格"
        else:
            name, basis = "比劫格", f"月令{mz}为日主同类之地，取比劫格"
        kind = "普通格"
    else:
        h = m_hidden[0]
        ss = shishen(dm, h)
        name = {
            "正官": "正官格", "七杀": "七杀格", "正财": "正财格", "偏财": "偏财格",
            "食神": "食神格", "伤官": "伤官格", "正印": "正印格", "偏印": "偏印格",
        }.get(ss, "杂气格")
        basis = f"月令{mz}藏干不透，以本气{h}（{ss}）论格"
        kind = "普通格"

    # 特殊格局判定
    strong = chart.strength_label in ("极强",)
    weak = chart.strength_label in ("极弱",)
    if weak:
        yin = [k for k in SHENG if SHENG[k] == dm_wx][0]
        root = any(GAN_WUXING[GAN.index(h)] in (dm_wx, yin) for h in chart.hidden_all())
        if not root:
            name = "从格（从势/从财杀）"
            basis = "日主极弱、四柱无根无印，弃命从势，宜顺不宜逆"
            kind = "特殊格"
    if strong:
        ke_me = [k for k in KE if KE[k] == dm_wx][0]
        cai = [k for k in KE if KE[dm_wx] == k][0]
        if (chart.element_scores[dm_wx] >= 55
                and chart.element_scores[ke_me] < 6.0
                and chart.element_scores[cai] < 6.0):
            name = {"木": "曲直仁寿格", "火": "炎上格", "土": "稼穑格",
                    "金": "从革格", "水": "润下格"}[dm_wx]
            basis = f"日主{dm_wx}气贯全局（{chart.element_scores[dm_wx]:.1f}%），成专旺之象"
            kind = "特殊格"

    chart.structure = {
        "name": name, "basis": basis, "kind": kind,
        "transparent": candidates,
        "month_hidden": m_hidden,
    }


def _analyse_tiaohou(chart: BaziChart) -> None:
    dm = chart.day_master
    mz = chart.month.zhi
    seq = TIAOHOU[dm][mz]
    present = set(chart.all_gan()) | set(chart.hidden_all())
    chart.tiaohou = {
        "sequence": seq,
        "primary": seq[0] if seq else "",
        "secondary": seq[1] if len(seq) > 1 else "",
        "satisfied": [c for c in seq if c in present],
        "missing": [c for c in seq if c not in present],
    }


# ---------------------------------------------------------------------------
# Shensha
# ---------------------------------------------------------------------------


def _find_shensha(chart: BaziChart) -> None:
    from . import shensha as _ss
    chart.shensha = _ss.compute(chart)


# ---------------------------------------------------------------------------
# Interactions
# ---------------------------------------------------------------------------


def _find_relations(chart: BaziChart) -> None:
    pos = ["年", "月", "日", "时"]
    zhis = chart.all_zhi()
    gans = chart.all_gan()
    rel: dict[str, list] = {"合": [], "冲": [], "刑": [], "害": [], "破": [],
                            "干合": [], "干冲": [], "三合": [], "三会": [], "半合": []}

    for i in range(4):
        for j in range(i + 1, 4):
            a, b = zhis[i], zhis[j]
            pair = f"{pos[i]}{a}·{pos[j]}{b}"
            if HE6[a] == b:
                rel["合"].append({"pair": pair, "type": "六合"})
            if CHONG[a] == b:
                rel["冲"].append({"pair": pair, "type": "六冲"})
            if HAI6[a] == b:
                rel["害"].append({"pair": pair, "type": "相害"})
            if PO[a] == b:
                rel["破"].append({"pair": pair, "type": "相破"})
            for grp in XING:
                if a in grp and b in grp and a != b:
                    rel["刑"].append({"pair": pair, "type": "相刑"})
            ga, gb = gans[i], gans[j]
            if GAN_HE.get(ga, ("",))[0] == gb:
                rel["干合"].append({"pair": f"{pos[i]}{ga}·{pos[j]}{gb}",
                                    "type": "天干五合", "result": GAN_HE[ga][1]})
            if GAN_CHONG.get(ga) == gb:
                rel["干冲"].append({"pair": f"{pos[i]}{ga}·{pos[j]}{gb}", "type": "天干相冲"})

    for grp in SANHE:
        hits = [(pos[i], zhis[i]) for i in range(4) if zhis[i] in grp[:3]]
        # 按「年→时」的首次出现顺序去重：用 set 的话字序随哈希变化，
        # 同一个盘每次运行可能显示成 丑巳 或 巳丑。
        uniq = list(dict.fromkeys(z for _, z in hits))
        if len(uniq) == 3:
            rel["三合"].append({"pair": "".join(uniq), "type": f"三合{grp[3]}局"})
        elif len(uniq) == 2:
            rel["半合"].append({"pair": "".join(uniq), "type": f"半合{grp[3]}局"})
    for grp in SANHUI:
        # 三会要三个「不同」地支。按命中数量判会把 卯辰辰 也算成三会木方，
        # 按出现次数判又会让 申申酉戌 通过 —— 两处都错，必须是去重后恰好三个。
        seen = list(dict.fromkeys(z for z in zhis if z in grp[:3]))
        if len(seen) == 3:
            rel["三会"].append({"pair": "".join(seen), "type": f"三会{grp[3]}方"})
    for z in set(zhis):
        if zhis.count(z) >= 2 and z in ("辰", "午", "酉", "亥"):
            rel["刑"].append({"pair": z + z, "type": "自刑"})
    chart.relations = {k: v for k, v in rel.items() if v}
