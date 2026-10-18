"""Luck cycles (大運), annual (流年) and monthly (流月) timelines."""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from ..calendar import astro, lunar
from ..calendar.ganzhi import (CHONG, GAN, GAN_CHONG, GAN_HE, GAN_WUXING, HAI6,
                               HE6, HIDDEN, KE, PO, SANHE, SHENG, TIANYI,
                               WENCHANG, ZHI, ZHI_WUXING, LU, shishen)
from . import gexi

POS_NAMES = ("年", "月", "日", "时")
POS_WEIGHT = {"年": 0.7, "月": 1.0, "日": 1.3, "时": 0.8}


@dataclass
class LuckCycle:
    index: int
    gan: str
    zhi: str
    start_age: int
    end_age: int
    start_year: int
    end_year: int
    shishen_gan: str
    shishen_zhi: str
    active: bool = False

    @property
    def label(self) -> str:
        return self.gan + self.zhi


@dataclass
class Period:
    """One year or one month on the timeline."""
    kind: str                  # 'year' | 'month'
    label: str                 # 干支
    gan: str = ""
    zhi: str = ""
    name: str = ""             # e.g. 2026 / 2026-03
    start: str = ""
    end: str = ""
    shishen_gan: str = ""
    shishen_zhi: str = ""
    score: float = 50.0
    band: str = ""
    components: dict = field(default_factory=dict)
    themes: list = field(default_factory=list)
    relations: list = field(default_factory=list)
    cautions: list = field(default_factory=list)
    opportunities: list = field(default_factory=list)
    luck_cycle: str = ""


import math as _math


def _r1(x: float) -> float:
    """Round half toward +infinity, i.e. exactly what JavaScript's Math.round does.

    Python's built-in round() is half-to-even, so round(-2.75, 1) is -2.8 while
    Math.round(-27.5) / 10 is -2.7. On a 0.05 boundary that flips the band
    ("平" vs "小吉") between the CLI and the browser. This matches the browser.
    """
    return _math.floor(x * 10 + 0.5) / 10


def _is_yang(gan: str) -> bool:
    return GAN.index(gan) % 2 == 0


def luck_direction(chart) -> int:
    """+1 順行, -1 逆行."""
    yang = _is_yang(chart.year.gan)
    male = chart.gender in ("male", "男", "m")
    return 1 if (yang == male) else -1


def start_luck(chart) -> tuple[int, int, _dt.datetime]:
    """(起運年數, 起運月數, 交運日期) — 3 日折 1 年."""
    direction = luck_direction(chart)
    # 用「钟表时刻」换算的真实 JD，不能用 chart.jd（那是真太阳时校正后的读数）：
    # 节气是北京时间的物理瞬间，拿校正值去减会把同一天的节判错，
    # 起运整整错开一个大运。与浏览器端保持一致。
    b = chart.birth_local
    jd_birth = astro.to_jd(b.year, b.month, b.day, b.hour, b.minute, b.second)
    if direction > 0:
        jd_ref = chart.jie_next[0]
        days = jd_ref - jd_birth
    else:
        jd_ref = chart.jie_prev[0]
        days = jd_birth - jd_ref
    total_months = days * 4.0                 # 1 日 = 4 個月
    years = int(total_months // 12)
    # 用 _r1 的取整方向：round(6.5)=6 而 JS 的 Math.round(6.5)=7，
    # 差一个月就可能把交运年推后一年（1929-06-20 那例 1933 vs 1934）。
    months = int(_math.floor((total_months - years * 12) + 0.5))
    if months >= 12:
        years += 1
        months -= 12
    # 交運日
    d = chart.birth_local
    y = d.year + years
    m = d.month + months
    if m > 12:
        y += 1
        m -= 12
    try:
        handover = d.replace(year=y, month=m)
    except ValueError:
        handover = d.replace(year=y, month=m, day=28)
    return years, months, handover


def luck_cycles(chart, count: int = 10, as_of: int | None = None) -> list[LuckCycle]:
    direction = luck_direction(chart)
    years, months, handover = start_luck(chart)
    base = (GAN.index(chart.month.gan), ZHI.index(chart.month.zhi))
    # the month pillar's sexagenary index
    m_idx = next(i for i in range(60)
                 if i % 10 == base[0] and i % 12 == base[1])
    out = []
    now_year = as_of or _dt.date.today().year
    start_year = handover.year
    for k in range(1, count + 1):
        idx = (m_idx + direction * k) % 60
        g, z = GAN[idx % 10], ZHI[idx % 12]
        sy = start_year + (k - 1) * 10
        cyc = LuckCycle(
            index=k, gan=g, zhi=z,
            start_age=years + (k - 1) * 10,
            end_age=years + (k - 1) * 10 + 9,
            start_year=sy, end_year=sy + 9,
            shishen_gan=shishen(chart.day_master, g),
            shishen_zhi=shishen(chart.day_master, HIDDEN[z][0]),
        )
        cyc.active = cyc.start_year <= now_year <= cyc.end_year
        out.append(cyc)
    return out


# ---------------------------------------------------------------------------
# Interaction engine
# ---------------------------------------------------------------------------


def zhi_relations(a: str, b: str) -> list[str]:
    out = []
    if HE6[a] == b:
        out.append("六合")
    if CHONG[a] == b:
        out.append("六冲")
    if HAI6[a] == b:
        out.append("相害")
    if PO[a] == b:
        out.append("相破")
    for grp in (("子", "卯"), ("寅", "巳", "申"), ("丑", "戌", "未")):
        if a in grp and b in grp and a != b:
            out.append("相刑")
    if a == b:
        if a in ("辰", "午", "酉", "亥"):
            out.append("自刑")
        else:
            out.append("伏吟")
    return out


def gan_relations(a: str, b: str) -> list[str]:
    out = []
    if GAN_HE.get(a, ("",))[0] == b:
        out.append("天干五合")
    if GAN_CHONG.get(a) == b:
        out.append("天干相冲")
    return out


def _element_of(gan: str, zhi: str) -> dict:
    d = {w: 0.0 for w in ("木", "火", "土", "金", "水")}
    d[GAN_WUXING[GAN.index(gan)]] += 0.40
    weights = {1: (1.0,), 2: (0.7, 0.3), 3: (0.6, 0.28, 0.12)}[len(HIDDEN[zhi])]
    for h, w in zip(HIDDEN[zhi], weights):
        d[GAN_WUXING[GAN.index(h)]] += 0.60 * w
    return d


def useful_elements(chart) -> tuple[list[str], list[str], dict]:
    """喜用与忌神 —— 走格局用神体系（见 bazi/gexi.py）。

    返回 (喜用, 忌, 说明)。喜用只有一到两个五行，忌神一到两个，其余是闲神；
    这是「流年能分出好坏」的前提。旧版把食伤财官（或印比）一股脑塞进喜用，
    五个五行全被分类，年年有话说，等于年年没话说。
    """
    sysd = gexi.useful_system(chart)
    explanation = {
        "primary": sysd["primary"],
        "primary_class": sysd["primary_class"],
        "rescue": sysd["rescue"],
        "neutral": sysd["neutral"],
        "strength_based": "；".join(sysd["why"]),
        "tiaohou": (f"调候主用{sysd['tiaohou_element'] or '—'}，"
                    f"仅作参看，不改用神"),
        "note": "用神以强弱定方向、格局定先后；流派不同结论可能不同，"
                "请用 events 校准。",
    }
    return sysd["favor"], sysd["avoid"], explanation


def strength_useful(chart) -> tuple[list[str], list[str], dict]:
    """扶抑派的粗判，仅供整体评分里的「身强用财官」一句判断使用。

    整体评分与分位数表是按这一套标定的，换掉会让所有人的分数一起漂移，
    所以这里保留旧口径，与流年所用的格局用神体系分开。
    """
    dm_wx = chart.day_master_wx
    yin = [k for k in SHENG if SHENG[k] == dm_wx][0]
    shi = SHENG[dm_wx]
    cai = KE[dm_wx]
    guan = [k for k in KE if KE[k] == dm_wx][0]
    strong = chart.strength >= 50
    if strong:
        return [shi, cai, guan], [dm_wx, yin], {"strong": True}
    return [yin, dm_wx], [cai, guan, shi], {"strong": False}


# ---------------------------------------------------------------------------
# Period scoring
# ---------------------------------------------------------------------------


def _band(score: float) -> str:
    """分档阈值按实际分布的分位数定，不是拍脑袋定的整数。

    旧阈值 80/68/58/46 把七成以上的年份塞进「平」和「小吉」，用户看到的
    是一条几乎平的线 —— 那不是命平，是刻度坏了。
    """
    if score >= 72:
        return "大吉"
    if score >= 63:
        return "吉"
    if score >= 55:
        return "小吉"
    if score >= 45:
        return "平"
    if score >= 40:
        return "小凶"
    if score >= 35:
        return "偏弱"
    return "凶"


THEME_MAP = {
    "比肩": ("同辈竞争", "合作与分利", "自我主张"),
    "劫财": ("合伙破财", "朋友借贷", "冲动消费"),
    "食神": ("创作输出", "口福与享受", "技术成名"),
    "伤官": ("突破常规", "口舌是非", "才艺外显"),
    "偏财": ("意外之财", "副业与投机", "异性缘"),
    "正财": ("正职收入", "稳健积累", "婚姻财务"),
    "七杀": ("压力与竞争", "权威挑战", "意外风险"),
    "正官": ("职位与名声", "制度约束", "责任加身"),
    "偏印": ("偏门学问", "灵感与孤独", "长辈助力"),
    "正印": ("学业与文书", "贵人庇护", "名誉提升"),
}


# 十神吉凶（《渊海子平》通行分法）
AUSPICIOUS = {"正财", "正印", "正官", "食神"}
OMINOUS = {"伤官", "七杀", "劫财", "偏印"}


def _ten_god_score(god: str, is_favor: bool) -> float:
    """吉神在流年为喜用最好；凶神为忌最重。"""
    if god in AUSPICIOUS:
        return 5.0 if is_favor else 1.5
    if god in OMINOUS:
        return -1.5 if is_favor else -5.0
    return 1.5 if is_favor else -1.5


def evaluate_period(chart, gan: str, zhi: str, luck: LuckCycle | None = None) -> dict:
    """流年/流月评分。

    判法依《子平真诠》「以用神为纲，以格局为本，以岁运为用」，顺序为：
        1. 先看喜忌 —— 干支五行是否命局所需（地支为主，天干主外）
        2. 再看十神 —— 吉神 / 凶神 / 中神 与喜忌交叉
        3. 后看会合刑冲 —— 「有合先论合，无合论刑冲」，合可解冲
        4. 再叠大运 —— 大运定十年基调，流年只是触发
        5. 神煞仅作辅助，不压过五行喜忌
    """
    dm = chart.day_master
    ss_g = shishen(dm, gan)
    ss_z = shishen(dm, HIDDEN[zhi][0])
    sysd = gexi.useful_system(chart)
    favor, avoid = sysd["favor"], sysd["avoid"]
    comp: dict[str, float] = {}

    # ---- 1) 喜忌：地支 0.6、天干 0.4，地支权重加倍（主吉凶之本体）---------
    # 只看喜、忌两类；闲神不论吉凶 —— 这是「平年」唯一可能的来源。
    add = _element_of(gan, zhi)
    es = chart.element_scores
    gain = 0.0
    loss = 0.0
    for el, v in add.items():
        if v <= 0:
            continue
        if el in favor:
            # 用神本身重于相神，不可等量齐观
            gain += v * (2.0 if el == sysd["primary"] else 1.5)
        elif el in avoid:
            ctrl = [k for k in KE if KE[k] == el][0]      # 克我者
            drain = SHENG[el]                              # 我生者（泄）
            checked = max(es.get(ctrl, 0), es.get(drain, 0))
            loss += v * (0.7 if checked >= 8 else 1.6)
    comp["用神"] = _r1(max(-20.0, min(20.0, (gain - loss) * 10.0)))
    comp["忌神有制"] = 1.0 if loss < sum(
        v * 1.6 for e, v in add.items() if e in avoid) else 0.0

    # ---- 2) 十神（吉凶随格局变：正官格见伤官是破格，伤官格见伤官是驾御）--
    el_gan = GAN_WUXING[GAN.index(gan)]
    el_zhi = GAN_WUXING[GAN.index(HIDDEN[zhi][0])]
    god_s = (gexi.god_score(ss_g, sysd, el_gan in favor, el_gan in avoid) * 0.45
             + gexi.god_score(ss_z, sysd, el_zhi in favor, el_zhi in avoid) * 0.65)
    comp["十神"] = _r1(god_s)

    # ---- 3) 会合刑冲（有合先论合，且冲合要分喜忌）------------------------
    # 旧版凡冲皆罚，于是「冲去忌神」这种本该去病的好年份被判成凶年。
    # 冲合真正的吉凶取决于**被作用的那一字是喜是忌**：
    #   冲忌神 → 去病为吉；冲用神 → 伤用为凶；冲闲神 → 动而无咎。
    rels: list[str] = []
    delta = 0.0
    POSW = {"年": 0.9, "月": 1.1, "日": 1.4, "时": 0.8}
    for i, p in enumerate(chart.pillars):
        pos = POS_NAMES[i]
        w = POSW[pos]
        zrels = zhi_relations(p.zhi, zhi)
        sign = gexi.rel_sign(sysd, p.zhi)          # 命局此支的喜忌
        has_he = "六合" in zrels
        for r in zrels:
            rels.append(f"{pos}支{p.zhi}与{zhi}{r}")
            if r == "六合":
                delta += (3.2 if sign > 0 else -3.0 if sign < 0 else 0.6) * w
            elif r == "六冲":
                # 合能解冲：本柱既合又冲时，冲力折半
                base = 4.5 if sign > 0 else (-6.5 if sign < 0 else -1.5)
                delta += base * (0.5 if has_he else 1.0) * w
            elif r == "相刑":
                delta -= 2.6 * w
            elif r in ("相害", "相破"):
                delta -= 1.6 * w
            elif r == "伏吟":
                delta -= 2.0 * w
        el_p = GAN_WUXING[GAN.index(p.gan)]
        s_gan = 1 if el_p in avoid else (-1 if el_p in favor else 0)
        for r in gan_relations(p.gan, gan):
            rels.append(f"{pos}干{p.gan}与{gan}{r}")
            if r == "天干相冲":
                delta += (3.0 if s_gan > 0 else -4.0 if s_gan < 0 else -1.0) * w
            elif r == "天干五合":
                delta += (2.2 if s_gan > 0 else -2.2 if s_gan < 0 else 0.6) * w
        if GAN_CHONG.get(p.gan) == gan and CHONG[p.zhi] == zhi:
            rels.append(f"与{pos}柱天克地冲")
            if sign > 0 and s_gan > 0:
                delta += 5.0 * w          # 天克地冲，克的都是忌神 —— 去病最彻底
            elif sign < 0 or s_gan < 0:
                delta -= 8.0 * w
            else:
                delta -= 3.0 * w
    for grp in SANHE:
        if zhi in grp[:3]:
            have = [z for z in chart.all_zhi() if z in grp[:3] and z != zhi]
            # 三合的吉凶看化神（grp[3]）是否为喜用，不看「合了就好」
            s_hua = 1 if grp[3] in favor else (-1 if grp[3] in avoid else 0)
            if len(set(have)) >= 2:
                delta += (5.5 if s_hua > 0 else -5.5 if s_hua < 0 else 1.5)
                rels.append(f"{zhi}与命局成三合{grp[3]}局")
            elif len(set(have)) == 1:
                delta += (2.2 if s_hua > 0 else -2.2 if s_hua < 0 else 0.6)
                rels.append(f"{zhi}与{have[0]}半合{grp[3]}局")
    # 一柱被冲可抵数项，若不设上限，三刑两冲一齐来时冲合项会压过喜忌，
    # 变成「只看冲不看用神」，与开篇定的顺序相反。
    comp["冲合"] = _r1(max(-12.0, min(12.0, delta)))

    # ---- 4) 大运（定十年基调，流年只作触发）------------------------------
    # 天干主外、地支主内，四六开；大运十神若为格局所忌，另计破格之罚。
    tone = 0.0
    big = 0.0
    if luck:
        lg, lz = luck.gan, luck.zhi
        e_lg = GAN_WUXING[GAN.index(lg)]
        e_lz = ZHI_WUXING[ZHI.index(lz)]
        s_lg = 1.0 if e_lg in favor else (-1.0 if e_lg in avoid else 0.0)
        s_lz = 1.0 if e_lz in favor else (-1.0 if e_lz in avoid else 0.0)
        tone = max(-1.0, min(1.0, s_lg * 0.4 + s_lz * 0.6))
        big = tone * 9.0
        l_god = shishen(dm, lg)
        l_zgod = shishen(dm, HIDDEN[lz][0])
        if l_god in sysd["dislike_gods"] or l_zgod in sysd["dislike_gods"]:
            big -= 3.0
            rels.append(f"大运{l_god}/{l_zgod}为格局所忌")
        if GAN_CHONG.get(lg) == gan and CHONG[lz] == zhi:
            big -= 6.0
            rels.append("大运流年天克地冲")
        if zhi == lz:
            big -= 2.0
            rels.append("流年伏吟大运")
        elif CHONG.get(lz) == zhi:
            big -= 1.5
            rels.append("流年冲大运")
    comp["大运"] = _r1(big)

    # ---- 5) 神煞（辅助，不压喜忌）----------------------------------------
    sha = 0.0
    if zhi in TIANYI.get(dm, ()):
        sha += 4.0
        rels.append("流年天乙贵人")
    if zhi == WENCHANG.get(dm):
        sha += 3.0
        rels.append("流年文昌")
    if zhi == LU.get(dm):
        sha += 3.0
        rels.append("流年临禄")
    if zhi in ("辰", "戌", "丑", "未") and ss_z in ("正官", "七杀"):
        sha -= 2.0
    comp["神煞"] = _r1(sha)

    raw = 50.0 + comp["用神"] + comp["十神"] + comp["冲合"] + comp["大运"] + comp["神煞"]

    # 大运吉而流年凶 → 不至大凶；大运凶而流年吉 → 吉力打折
    if tone > 0 and raw < 50:
        raw = 50 - (50 - raw) * (1 - 0.42 * tone)
    elif tone < 0 and raw > 50:
        raw = 50 + (raw - 50) * (1 - 0.42 * abs(tone))

    # 收窄到 32–94：单年读数是「倾向」而非「判决」。
    # 0.72 的压缩会把标准差一起压掉，好坏年看起来一样；0.85 保留区分度。
    # 下限放到 32 而不是 40，否则最差的一批年份全堆在同一个数上，
    # 点「凶年」和「较差」得到同一个读数，反而没有信息。
    score = 50.0 + (max(0.0, min(100.0, raw)) - 50.0) * 0.85
    score = max(32.0, min(94.0, score))
    comp["base"] = 50.0
    comp["raw"] = _r1(raw)
    comp["大运基调"] = round(tone, 2)

    themes = list(THEME_MAP.get(ss_g, ())) + list(THEME_MAP.get(ss_z, ()))
    seen, th = set(), []
    for t in themes:
        if t not in seen:
            seen.add(t)
            th.append(t)

    cautions: list[str] = []
    for r in rels:
        if "六冲" in r and "日" in r:
            cautions.append("日支被冲：住所、婚姻或自身状态易有变动，忌仓促决定")
        elif "六冲" in r and "月" in r:
            cautions.append("月柱被冲：工作环境或家庭结构面临调整")
        elif "六冲" in r and "年" in r:
            cautions.append("年柱被冲：长辈、根基或长期规划受扰")
        elif "六冲" in r and "时" in r:
            cautions.append("时柱被冲：子女、下属或投资标的易有变动")
        elif "天克地冲" in r:
            cautions.append("天克地冲：该领域阻力最大，宜守不宜攻")
        elif "相刑" in r:
            cautions.append("相刑：易生是非、官非或健康小疾，注意契约与口舌")
        elif "相害" in r:
            cautions.append("相害：人际暗耗，慎防被牵连")
        elif "伏吟" in r:
            cautions.append("伏吟：旧事重来，情绪反复，宜静守")
    if ss_g in OMINOUS and score < 48:
        cautions.append(f"{ss_g}当值而全局失衡：压力与是非集中，忌硬碰体制与上级")
    if ss_g in AUSPICIOUS and score >= 55:
        cautions.append("吉神当值，宜按程序推进，勿走捷径以免失信")

    opps: list[str] = []
    if score >= 62:
        opps.append(f"{ss_g}/{ss_z}得用，是推进主业与积累信誉的窗口")
    joined = " ".join(rels)
    if "天乙贵人" in joined:
        opps.append("天乙贵人到位：主动求见关键人物，成功率高")
    if "文昌" in joined:
        opps.append("文昌到位：考试、论文、资格与公开发表皆宜")
    if "临禄" in joined:
        opps.append("临禄：正财与职位稳固，适合谈薪与升迁")
    if comp["用神"] >= 12:
        opps.append(f"喜用{''.join(favor)}当令，资源顺势而来，宜进取")
    if "三合" in joined or "半合" in joined:
        opps.append("成合局：宜合作、宜结盟，借他人之力成事")

    # 同一句提示可能由多个柱位触发（例如两柱伏吟），去重后只留一次
    cautions = list(dict.fromkeys(cautions))
    opps = list(dict.fromkeys(opps))
    return {
        "shishen_gan": ss_g, "shishen_zhi": ss_z, "score": _r1(score),
        "band": _band(_r1(score)), "components": comp, "relations": rels,
        "themes": th, "cautions": cautions, "opportunities": opps,
    }


def year_period(chart, year: int, luck: LuckCycle | None = None) -> Period:
    idx = (year - 4) % 60
    g, z = GAN[idx % 10], ZHI[idx % 12]
    ev = evaluate_period(chart, g, z, luck)
    start = astro.from_jd(astro.term_local(year, "立春"))
    end = astro.from_jd(astro.term_local(year + 1, "立春"))
    p = Period(kind="year", label=g + z, gan=g, zhi=z, name=str(year),
               start="%04d-%02d-%02d" % start[:3],
               end="%04d-%02d-%02d" % end[:3],
               luck_cycle=luck.label if luck else "")
    p.score, p.band = ev["score"], ev["band"]
    p.shishen_gan, p.shishen_zhi = ev["shishen_gan"], ev["shishen_zhi"]
    p.components, p.relations = ev["components"], ev["relations"]
    p.themes, p.cautions, p.opportunities = (ev["themes"], ev["cautions"],
                                             ev["opportunities"])
    return p


def month_periods(chart, year: int, luck: LuckCycle | None = None) -> list[Period]:
    """12 節氣 months of a 流年 (立春 -> next 立春)."""
    out = []
    order = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑",
             "立秋", "白露", "寒露", "立冬", "大雪", "小寒"]
    yg = GAN[(year - 4) % 10]
    # 流年基调：流月是「节奏」，流年是「主题」，月份必须围绕年走，
    # 而不是各自独立算完再压到 50 —— 那样十二个月的读数几乎一样。
    n_zhi = ZHI[(year - 4) % 12]
    base = evaluate_period(chart, yg, n_zhi, luck)
    for k, name in enumerate(order):
        yy = year if name != "小寒" else year + 1
        start = astro.term_local(yy, name)
        nxt_name = order[k + 1] if k + 1 < 12 else "立春"
        nxt_year = yy if k + 1 < 12 else year + 1
        try:
            end = astro.term_local(nxt_year, nxt_name)
        except Exception:
            end = start + 30
        # 月柱
        zhi = ["寅", "卯", "辰", "巳", "午", "未",
               "申", "酉", "戌", "亥", "子", "丑"][k]
        first = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}[GAN.index(yg)]
        gan = GAN[(first + k) % 10]
        ev = evaluate_period(chart, gan, zhi, luck)
        s = astro.from_jd(start)
        e = astro.from_jd(end)
        p = Period(kind="month", label=gan + zhi, gan=gan, zhi=zhi,
                   name="%04d-%02d" % (s[0], s[1]),
                   start="%04d-%02d-%02d" % s[:3],
                   end="%04d-%02d-%02d" % e[:3])
        p.score = ev["score"]
        # 流月 = 流年基调 + (月令与流年的差异) × 0.55
        # 不围着流年走，月份就成了十二个互不相干的读数；压得太狠又会全挤在中间。
        p.score = _r1(base["score"] + (ev["score"] - base["score"]) * 0.55)
        p.band = _band(p.score)
        p.shishen_gan, p.shishen_zhi = ev["shishen_gan"], ev["shishen_zhi"]
        p.components, p.relations = ev["components"], ev["relations"]
        p.themes, p.cautions, p.opportunities = (ev["themes"], ev["cautions"],
                                                 ev["opportunities"])
        out.append(p)
    return out


def _today_jd() -> float:
    n = _dt.datetime.now()
    return astro.to_jd(n.year, n.month, n.day, n.hour, n.minute)


def timeline(chart, from_year: int | None = None, years: int = 12,
             as_of_year: int | None = None) -> list[dict]:
    """Consecutive 流年 with the governing 大运 attached."""
    start = from_year or (as_of_year or _dt.date.today().year) - 2
    cycles = luck_cycles(chart, count=12, as_of=start)
    out = []
    for y in range(start, start + years):
        cyc = next((c for c in cycles if c.start_year <= y <= c.end_year), None)
        p = year_period(chart, y, cyc)
        d = p.__dict__.copy()
        d["luck_cycle"] = cyc.label if cyc else ""
        d["age"] = y - chart.birth_local.year + 1
        out.append(d)
    return out
